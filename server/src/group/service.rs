use crate::{
    assets::service::{AssetPurpose, ensure_claimable},
    auth::session_context::{is_superadmin, remember_visited_group, resolve_landing_group},
    common::{
        client::ClientInfo,
        cloudinary::Cloudinary,
        extractors::TenantContext,
        group_type::GroupType,
        name_generator::generate_user_name,
        names::DisplayName,
        permission::GroupPermissions,
        role::{MemberRole, Role},
    },
    error::{AppError, AppResult},
    group::{
        dto::{CourseSetup, GroupMemberDto, GroupStatusDto, GroupSummaryDto},
        invite_token::{InviteToken, invalid_invite},
        member_policy::{self, Caller, Target},
    },
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

const INVITE_TTL: chrono::TimeDelta = chrono::TimeDelta::days(7);

/// Locks the group row for the rest of the transaction. Every change to a
/// group's membership takes this lock first, so an owner check in one request
/// cannot interleave with an ownership transfer in another.
pub(crate) async fn lock_group_owner(conn: &mut PgConnection, tenant_id: Uuid) -> AppResult<Uuid> {
    sqlx::query_scalar!(
        r#"SELECT owner_id FROM groups WHERE id = $1 FOR UPDATE"#,
        tenant_id
    )
    .fetch_optional(conn)
    .await?
    .ok_or_else(|| AppError::not_found("Group not found."))
}

/// An unknown id means the `roles` table and `Role` drifted apart, which must
/// surface as an error rather than quietly demote someone to a plain member.
pub(crate) fn role_from_db(id: i32) -> AppResult<Role> {
    Role::from_db_id(id.into()).ok_or_else(|| AppError::internal(format!("Unknown role id {id}")))
}

pub struct CreateGroupParams<'a> {
    pub user_id: Uuid,
    pub group_name: &'a DisplayName,
    /// An upload of the creator for this purpose.
    pub avatar_id: Option<Uuid>,
    pub group_type: GroupType,
    pub dalton_enabled: bool,
    pub client: &'a ClientInfo,
}

struct Membership {
    id: Uuid,
    name: String,
    owner_id: Uuid,
    schedule_config: Value,
    avatar_public_id: Option<String>,
    permissions: Value,
    group_type: String,
    dalton_enabled: bool,
    role_name: String,
    done_course_setup: bool,
    offers_course_choice: bool,
}

pub struct AcceptInviteParams<'a> {
    pub user_id: Uuid,
    pub token: &'a InviteToken,
    pub client: &'a ClientInfo,
}

pub struct GroupService {
    db: PgPool,
    cloudinary: Cloudinary,
}

impl GroupService {
    pub fn from_state(s: &AppState) -> Self {
        Self {
            db: s.db.clone(),
            cloudinary: s.cloudinary.clone(),
        }
    }

    pub async fn create_group(&self, params: CreateGroupParams<'_>) -> AppResult<Value> {
        let user_id = params.user_id;
        let group_name = params.group_name;
        let avatar_id = params.avatar_id;
        let group_type = params.group_type;
        let dalton_enabled = params.dalton_enabled;

        let mut tx = self.db.begin().await?;

        if let Some(avatar_id) = avatar_id {
            ensure_claimable(&mut *tx, avatar_id, AssetPurpose::GroupAvatar, user_id).await?;
        }

        let group = sqlx::query!(
            r#"INSERT INTO groups (name, avatar_id, owner_id, group_type, dalton_enabled)
               VALUES ($1, $2, $3, $4, $5) RETURNING id, name"#,
            group_name.as_str(),
            avatar_id,
            user_id,
            group_type.as_str(),
            dalton_enabled
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(avatar_in_use_on_conflict)?;

        let group_id = group.id;
        let group_name_str = group.name;

        sqlx::query!(
            r#"INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)"#,
            user_id,
            Role::Admin.db_id_i32(),
            group_id
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::GroupCreated)
            .actor(user_id)
            .tenant(group_id)
            .client(params.client)
            .metadata(json!({
                "groupName": group_name_str,
                "groupType": group_type.as_str(),
                "daltonEnabled": dalton_enabled,
            }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "groupId": group_id }))
    }

    pub async fn get_status(&self, user_id: Option<Uuid>) -> AppResult<GroupStatusDto> {
        let Some(user_id) = user_id else {
            return Ok(GroupStatusDto {
                authenticated: false,
                groups: Vec::new(),
                landing_group_id: None,
            });
        };

        // Independent reads, so they run concurrently.
        let (is_superadmin, landing_group_id, memberships) = tokio::try_join!(
            is_superadmin(&self.db, user_id),
            resolve_landing_group(&self.db, user_id),
            self.memberships(user_id),
        )?;

        let groups = memberships
            .into_iter()
            .map(|g| {
                let role = Role::from_str_or_user(&g.role_name);
                let has_owner_rights = is_superadmin || g.owner_id == user_id;
                let permissions = GroupPermissions::from_json_with_defaults(&g.permissions);
                let effective_permissions = permissions.effective_keys(role, has_owner_rights);

                GroupSummaryDto {
                    id: g.id,
                    name: g.name,
                    owner_id: g.owner_id,
                    role: role.as_str(),
                    schedule_config: g.schedule_config,
                    avatar_url: g.avatar_public_id.map(|id| self.cloudinary.image_url(&id)),
                    permissions,
                    group_type: GroupType::from_str_or_regular(&g.group_type).as_str(),
                    dalton_enabled: g.dalton_enabled,
                    effective_permissions,
                    course_setup: CourseSetup::of(g.done_course_setup, g.offers_course_choice),
                }
            })
            .collect();

        Ok(GroupStatusDto {
            authenticated: true,
            groups,
            landing_group_id,
        })
    }

    async fn memberships(&self, user_id: Uuid) -> AppResult<Vec<Membership>> {
        Ok(sqlx::query_as!(
            Membership,
            r#"SELECT g.id, g.name, g.owner_id, g.schedule_config, avatar.public_id AS "avatar_public_id?",
                      g.permissions, g.group_type, g.dalton_enabled, r.name AS role_name,
                      ur.done_course_setup,
                      EXISTS (SELECT 1 FROM courses c
                              JOIN subjects s ON s.id = c.subject_id
                              WHERE s.tenant_id = g.id AND s.category <> 'core')
                          AS "offers_course_choice!"
               FROM user_roles ur
               JOIN groups g ON g.id = ur.tenant_id
               JOIN roles r ON r.id = ur.role_id
               LEFT JOIN assets avatar ON avatar.id = g.avatar_id
               WHERE ur.user_id = $1
               ORDER BY ur.assigned_at"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?)
    }

    /// Also serves superadmins looking at a group they are not a member of,
    /// which therefore is missing from their status list.
    pub async fn get_group(&self, tc: &TenantContext) -> AppResult<GroupSummaryDto> {
        let g = sqlx::query!(
            r#"SELECT g.name AS "name!", g.schedule_config AS "schedule_config!",
                      avatar.public_id AS "avatar_public_id?",
                      g.group_type AS "group_type!", g.dalton_enabled AS "dalton_enabled!",
                      COALESCE(ur.done_course_setup, false) AS "done_course_setup!",
                      ur.user_id IS NOT NULL AND EXISTS (
                          SELECT 1 FROM courses c
                          JOIN subjects s ON s.id = c.subject_id
                          WHERE s.tenant_id = g.id AND s.category <> 'core'
                      ) AS "offers_course_choice!"
               FROM groups g
               LEFT JOIN assets avatar ON avatar.id = g.avatar_id
               LEFT JOIN user_roles ur ON ur.tenant_id = g.id AND ur.user_id = $2
               WHERE g.id = $1"#,
            tc.tenant_id,
            tc.user.user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Group not found."))?;

        Ok(GroupSummaryDto {
            id: tc.tenant_id,
            name: g.name,
            owner_id: tc.group_owner_id,
            role: tc.tenant_role.as_str(),
            schedule_config: g.schedule_config,
            avatar_url: g.avatar_public_id.map(|id| self.cloudinary.image_url(&id)),
            permissions: tc.group_permissions.clone(),
            group_type: GroupType::from_str_or_regular(&g.group_type).as_str(),
            dalton_enabled: g.dalton_enabled,
            effective_permissions: tc.effective_permission_keys(),
            course_setup: CourseSetup::of(g.done_course_setup, g.offers_course_choice),
        })
    }

    pub async fn record_visit(&self, user_id: Uuid, group_id: Uuid) -> AppResult<()> {
        remember_visited_group(&self.db, user_id, group_id).await
    }

    pub async fn leave_group(&self, user_id: Uuid, group_id: Uuid) -> AppResult<()> {
        let mut tx = self.db.begin().await?;
        let owner_id = lock_group_owner(&mut tx, group_id).await?;

        if owner_id == user_id {
            return Err(AppError::forbidden("The owner cannot leave the group."));
        }

        let left = sqlx::query!(
            r#"DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2"#,
            user_id,
            group_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        // A superadmin can reach a group without belonging to it.
        if left == 0 {
            return Err(AppError::bad_request("You are not a member of this group."));
        }

        sqlx::query!(
            r#"DELETE FROM user_courses
               WHERE user_id = $1
                 AND course_id IN (SELECT id FROM courses WHERE tenant_id = $2)"#,
            user_id,
            group_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'group:leave', $2)"#,
            user_id,
            json!({ "groupId": group_id })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }

    pub async fn create_invite(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let token = InviteToken::generate();
        let expires_at = chrono::Utc::now() + INVITE_TTL;

        let mut tx = self.db.begin().await?;

        let invite_id = sqlx::query_scalar!(
            r#"INSERT INTO group_invites (token, tenant_id, created_by, expires_at)
               VALUES ($1, $2, $3, $4)
               RETURNING id"#,
            token.as_str(),
            tenant_id,
            user_id,
            expires_at
        )
        .fetch_one(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::InviteCreated)
            .actor(user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "inviteId": invite_id, "expiresAt": expires_at }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "token": token.as_str() }))
    }

    pub async fn list_members(
        &self,
        tenant_id: Uuid,
        caller: Caller,
    ) -> AppResult<Vec<GroupMemberDto>> {
        let owner_id =
            sqlx::query_scalar!(r#"SELECT owner_id FROM groups WHERE id = $1"#, tenant_id)
                .fetch_optional(&self.db)
                .await?
                .ok_or_else(|| AppError::not_found("Group not found."))?;

        let rows = sqlx::query!(
            r#"SELECT user_id, assigned_at, role_id FROM user_roles WHERE tenant_id = $1"#,
            tenant_id
        )
        .fetch_all(&self.db)
        .await?;

        let targets = rows
            .into_iter()
            .map(|r| {
                let role = role_from_db(r.role_id)?;
                Ok((r.user_id, r.assigned_at, role))
            })
            .collect::<AppResult<Vec<_>>>()?;

        let caller_role = targets
            .iter()
            .find(|(user_id, ..)| *user_id == caller.user_id)
            .map(|(.., role)| *role);
        let actor = caller.resolve(owner_id, caller_role);

        let mut members: Vec<GroupMemberDto> = targets
            .into_iter()
            .map(|(user_id, joined_at, role)| {
                let target = Target {
                    user_id,
                    role: MemberRole::resolve(role, user_id == owner_id),
                };
                GroupMemberDto {
                    generated_name: generate_user_name(&user_id.to_string()),
                    role: target.role,
                    user_id,
                    joined_at,
                    assignable_roles: member_policy::assignable_roles(actor, target),
                    can_remove: member_policy::ensure_can_remove(actor, target).is_ok(),
                }
            })
            .collect();

        members.sort_by(|a, b| {
            a.role
                .cmp(&b.role)
                .then_with(|| a.generated_name.cmp(&b.generated_name))
        });

        Ok(members)
    }

    /// `viewer_id` lets an existing member skip the join prompt; the group id is
    /// only revealed to members so the preview stays anonymous for everyone else.
    pub async fn get_invite(
        &self,
        token: &InviteToken,
        viewer_id: Option<Uuid>,
    ) -> AppResult<Value> {
        let invite = sqlx::query!(
            r#"SELECT g.id,
                      g.name,
                      avatar.public_id AS "avatar_public_id?",
                      (SELECT COUNT(*) FROM user_roles WHERE tenant_id = g.id) AS "member_count!",
                      EXISTS (
                          SELECT 1 FROM user_roles WHERE tenant_id = g.id AND user_id = $2
                      ) AS "already_member!"
               FROM group_invites gi
               JOIN groups g ON g.id = gi.tenant_id
               LEFT JOIN assets avatar ON avatar.id = g.avatar_id
               WHERE gi.token = $1 AND gi.expires_at > now() AND gi.used_at IS NULL AND gi.revoked_at IS NULL"#,
            token.as_str(),
            viewer_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(invalid_invite)?;

        Ok(json!({
            "valid": true,
            "groupName": invite.name,
            "avatarUrl": invite.avatar_public_id.map(|id| self.cloudinary.image_url(&id)),
            "memberCount": invite.member_count,
            "alreadyMember": invite.already_member,
            "groupId": invite.already_member.then_some(invite.id),
        }))
    }

    pub async fn accept_invite(&self, params: AcceptInviteParams<'_>) -> AppResult<Value> {
        let user_id = params.user_id;
        let token = params.token;

        let mut tx = self.db.begin().await?;

        // Invites are single-use, so an existing member must not burn the token.
        let invite = sqlx::query!(
            r#"UPDATE group_invites gi SET used_at = now(), used_by = $2
               WHERE gi.token = $1 AND gi.expires_at > now() AND gi.used_at IS NULL AND gi.revoked_at IS NULL
                 AND NOT EXISTS (
                     SELECT 1 FROM user_roles ur WHERE ur.tenant_id = gi.tenant_id AND ur.user_id = $2
                 )
               RETURNING gi.id, gi.tenant_id"#,
            token.as_str(),
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        let (invite_id, group_id) = match invite {
            Some(row) => (row.id, row.tenant_id),
            None => {
                tx.rollback().await?;
                return self.resolve_unaccepted_invite(token, user_id).await;
            }
        };

        let ban = sqlx::query!(
            "SELECT id FROM group_bans WHERE tenant_id = $1 AND user_id = $2",
            group_id,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        if ban.is_some() {
            return Err(AppError::BannedFromGroup);
        }

        // Joining twice keeps the existing membership and its role.
        sqlx::query!(
            r#"INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)
               ON CONFLICT (user_id, tenant_id) WHERE tenant_id IS NOT NULL DO NOTHING"#,
            user_id,
            Role::User.db_id_i32(),
            group_id
        )
        .execute(&mut *tx)
        .await?;

        // The token is a bearer credential and stays out of the log.
        SecurityEvent::new(SecurityEventKind::InviteAccepted)
            .user(user_id)
            .actor(user_id)
            .tenant(group_id)
            .client(params.client)
            .metadata(json!({ "inviteId": invite_id }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "groupId": group_id, "alreadyMember": false }))
    }

    /// Distinguishes "already a member" from an invalid token after the
    /// consuming update matched nothing.
    async fn resolve_unaccepted_invite(
        &self,
        token: &InviteToken,
        user_id: Uuid,
    ) -> AppResult<Value> {
        let membership = sqlx::query!(
            r#"SELECT gi.tenant_id
               FROM group_invites gi
               JOIN user_roles ur ON ur.tenant_id = gi.tenant_id AND ur.user_id = $2
               WHERE gi.token = $1 AND gi.expires_at > now() AND gi.used_at IS NULL AND gi.revoked_at IS NULL"#,
            token.as_str(),
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(invalid_invite)?;

        Ok(json!({ "ok": true, "groupId": membership.tenant_id, "alreadyMember": true }))
    }
}

/// Each upload can picture one group only; a second claim of the same upload
/// loses the race to the unique `avatar_id`.
pub(crate) fn avatar_in_use_on_conflict(err: sqlx::Error) -> AppError {
    match err.as_database_error() {
        Some(db) if db.is_unique_violation() => crate::assets::service::invalid_upload(),
        _ => AppError::Database(err),
    }
}
