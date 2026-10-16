use crate::{
    assets::service::{AssetPurpose, ensure_claimable},
    common::{
        client::ClientInfo,
        group_type::{DEFAULT_COURSE_TYPE, GroupType, ZUSATZKURS_CATEGORY, resolve_course_type},
        names::DisplayName,
        permission::{GroupPermissions, Permission},
        role::{MemberRole, Role},
    },
    error::{AppError, AppResult},
    group::{
        dto::{ReplaceScheduleDto, ScheduleConfigDto, ScheduleLessonDto, ScheduleSubDto},
        member_policy::{self, Actor, Caller, Target},
        service::{avatar_in_use_on_conflict, lock_group_owner, role_from_db},
    },
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use chrono::NaiveTime;
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::{PgConnection, PgPool};
use std::collections::{BTreeMap, HashSet};
use uuid::Uuid;

const SUBJECT_NAME_TAKEN: &str = "A subject with this name already exists.";
const COURSE_NAME_TAKEN: &str = "A course with this name already exists.";

/// Lessons split into one array per column, so the whole schedule is written
/// with a single `UNNEST` statement instead of one round-trip per lesson.
struct LessonColumns {
    ids: Vec<Uuid>,
    days: Vec<i32>,
    slots: Vec<i32>,
    durations: Vec<i32>,
    rooms: Vec<Option<String>>,
    subject_ids: Vec<Option<Uuid>>,
    course_ids: Vec<Option<Uuid>>,
    is_dalton: Vec<bool>,
}

impl From<Vec<ScheduleLessonDto>> for LessonColumns {
    fn from(lessons: Vec<ScheduleLessonDto>) -> Self {
        let n = lessons.len();
        let mut columns = Self {
            ids: Vec::with_capacity(n),
            days: Vec::with_capacity(n),
            slots: Vec::with_capacity(n),
            durations: Vec::with_capacity(n),
            rooms: Vec::with_capacity(n),
            subject_ids: Vec::with_capacity(n),
            course_ids: Vec::with_capacity(n),
            is_dalton: Vec::with_capacity(n),
        };

        for lesson in lessons {
            columns.ids.push(lesson.id.unwrap_or_else(Uuid::new_v4));
            columns.days.push(lesson.day);
            columns.slots.push(lesson.slot);
            columns.durations.push(lesson.duration);
            columns.rooms.push(
                lesson
                    .room
                    .map(|room| room.trim().to_owned())
                    .filter(|room| !room.is_empty()),
            );
            columns.subject_ids.push(lesson.subject_id);
            columns.course_ids.push(lesson.course_id);
            columns.is_dalton.push(lesson.is_dalton);
        }

        columns
    }
}

struct LockedMembership {
    owner_id: Uuid,
    actor: Actor,
    target: Target,
}

struct MuteLift {
    tenant_id: Uuid,
    target: Uuid,
    actor: Uuid,
    reason: UnmuteReason,
}

/// Recorded with the lifted mute, so the log tells a moderator's decision
/// apart from a promotion.
#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
enum UnmuteReason {
    Unmuted,
    Promoted,
}

pub struct GroupAdminService {
    db: PgPool,
}

/// The category a new subject gets when the client does not send one.
const fn default_category(group_type: GroupType) -> &'static str {
    match group_type {
        GroupType::Regular => "core",
        GroupType::Abitur => "mandatory",
    }
}

/// Categories belong to exactly one kind of group, so a group that switched its
/// type keeps its old subjects but can only assign categories that fit now.
fn validate_category(group_type: GroupType, category: &str) -> AppResult<()> {
    if group_type.allows_category(category) {
        return Ok(());
    }

    Err(AppError::bad_request(format!(
        "Category '{category}' is not available in this group. Allowed: {}.",
        group_type.subject_categories().join(", ")
    )))
}

const MAX_SCHEDULE_TEXT_CHARS: usize = 100;

/// Blank text changes nothing, so it is stored as no change at all.
fn non_blank(text: Option<String>) -> Option<String> {
    text.map(|t| t.trim().to_owned()).filter(|t| !t.is_empty())
}

/// Bounds the free-form parts of a substitution to what the schedule can show,
/// and rejects one that would leave the lesson as it is.
fn validate_schedule_sub(dto: ScheduleSubDto) -> AppResult<ScheduleSubDto> {
    let dto = ScheduleSubDto {
        subject: non_blank(dto.subject),
        room: non_blank(dto.room),
        ..dto
    };
    let too_long = |text: &Option<String>| {
        text.as_deref()
            .is_some_and(|t| t.chars().count() > MAX_SCHEDULE_TEXT_CHARS)
    };

    if dto.day.is_some_and(|day| !(1..=5).contains(&day))
        || dto.slot.is_some_and(|slot| slot < 1)
        || dto.duration.is_some_and(|duration| duration < 1)
        || too_long(&dto.subject)
        || too_long(&dto.room)
    {
        return Err(AppError::bad_request(
            "The substitution does not fit the school week or its texts are too long.",
        ));
    }

    let changes_nothing = dto.cancelled != Some(true)
        && dto.day.is_none()
        && dto.slot.is_none()
        && dto.duration.is_none()
        && dto.subject.is_none()
        && dto.room.is_none();
    if changes_nothing {
        return Err(AppError::bad_request(
            "The substitution does not change the lesson.",
        ));
    }

    Ok(dto)
}

/// Every break, on every day, follows one of the configured slots and lasts
/// between 1 and 180 minutes; only school days can have breaks of their own.
fn validate_breaks(config: &ScheduleConfigDto) -> AppResult<()> {
    let invalid = |breaks: &BTreeMap<i32, i32>| {
        breaks.iter().any(|(slot, duration)| {
            !(1..=config.total_slots).contains(slot) || !(1..=180).contains(duration)
        })
    };

    if invalid(&config.breaks)
        || config
            .day_breaks
            .iter()
            .any(|(day, breaks)| !(1..=5).contains(day) || invalid(breaks))
    {
        return Err(AppError::bad_request(
            "Breaks must belong to a valid slot and last between 1 and 180 minutes.",
        ));
    }

    Ok(())
}

/// Dalton stands in for a subject in the schedule, so a Dalton lesson cannot
/// point at a real subject or course as well.
fn validate_dalton_lesson(
    is_dalton: bool,
    subject_id: Option<Uuid>,
    course_id: Option<Uuid>,
) -> AppResult<()> {
    if is_dalton && (subject_id.is_some() || course_id.is_some()) {
        return Err(AppError::bad_request(
            "A Dalton lesson cannot belong to a subject or course.",
        ));
    }

    Ok(())
}

impl GroupAdminService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    async fn group_type(&self, tenant_id: Uuid) -> AppResult<GroupType> {
        let row = sqlx::query_scalar!(r#"SELECT group_type FROM groups WHERE id = $1"#, tenant_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::not_found("Group not found"))?;

        Ok(GroupType::from_str_or_regular(&row))
    }

    async fn ensure_dalton_enabled(&self, tenant_id: Uuid) -> AppResult<()> {
        let enabled = sqlx::query_scalar!(
            r#"SELECT dalton_enabled FROM groups WHERE id = $1"#,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Group not found"))?;

        if enabled {
            Ok(())
        } else {
            Err(AppError::bad_request(
                "Dalton is not enabled for this group.",
            ))
        }
    }

    /// Ensures every lesson only points at subjects and courses of this group,
    /// and that a lesson's course really belongs to its subject.
    async fn validate_lesson_references(
        &self,
        tenant_id: Uuid,
        lessons: &[(Option<Uuid>, Option<Uuid>)],
    ) -> AppResult<()> {
        let subject_ids: Vec<Uuid> = lessons
            .iter()
            .filter_map(|(subject_id, _)| *subject_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        if !subject_ids.is_empty() {
            let known = sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM subjects WHERE tenant_id = $1 AND id = ANY($2)"#,
                tenant_id,
                &subject_ids
            )
            .fetch_one(&self.db)
            .await?
            .unwrap_or(0);

            if known != subject_ids.len() as i64 {
                return Err(AppError::bad_request(
                    "A lesson references a subject outside this group.",
                ));
            }
        }

        let course_ids: Vec<Uuid> = lessons
            .iter()
            .filter_map(|(_, course_id)| *course_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        if course_ids.is_empty() {
            return Ok(());
        }

        let course_subjects: std::collections::HashMap<Uuid, Uuid> = sqlx::query!(
            r#"SELECT id, subject_id FROM courses WHERE tenant_id = $1 AND id = ANY($2)"#,
            tenant_id,
            &course_ids
        )
        .fetch_all(&self.db)
        .await?
        .into_iter()
        .map(|row| (row.id, row.subject_id))
        .collect();

        for (subject_id, course_id) in lessons {
            let Some(course_id) = course_id else { continue };

            let Some(course_subject) = course_subjects.get(course_id) else {
                return Err(AppError::bad_request(
                    "A lesson references a course outside this group.",
                ));
            };

            if subject_id.is_some_and(|subject_id| subject_id != *course_subject) {
                return Err(AppError::bad_request(
                    "A lesson references a course that belongs to a different subject.",
                ));
            }
        }

        Ok(())
    }

    pub async fn get_banned_users(&self, tenant_id: Uuid) -> AppResult<Value> {
        let rows = sqlx::query!(
            r#"SELECT user_id, banned_at FROM group_bans WHERE tenant_id = $1"#,
            tenant_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(json!(
            rows.into_iter()
                .map(|r| {
                    let generated_name =
                        crate::common::name_generator::generate_user_name(&r.user_id.to_string());
                    json!({
                        "userId": r.user_id,
                        "generatedName": generated_name,
                        "bannedAt": r.banned_at
                    })
                })
                .collect::<Vec<_>>()
        ))
    }

    pub async fn revert_ban(
        &self,
        tenant_id: Uuid,
        current_user_id: Uuid,
        target: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        let unbanned = sqlx::query!(
            r#"DELETE FROM group_bans WHERE user_id = $1 AND tenant_id = $2"#,
            target,
            tenant_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if unbanned > 0 {
            SecurityEvent::new(SecurityEventKind::MemberUnbanned)
                .user(target)
                .actor(current_user_id)
                .tenant(tenant_id)
                .client(client)
                .record(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    /// Locks the group and reads the caller's and target's roles inside the
    /// membership transaction, so no concurrent change can make them stale.
    async fn lock_membership(
        tx: &mut PgConnection,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
    ) -> AppResult<LockedMembership> {
        let owner_id = lock_group_owner(tx, tenant_id).await?;

        let rows = sqlx::query!(
            r#"SELECT user_id, role_id FROM user_roles
               WHERE tenant_id = $1 AND user_id = ANY($2)"#,
            tenant_id,
            &[caller.user_id, target][..]
        )
        .fetch_all(&mut *tx)
        .await?;

        let role_of = |user_id: Uuid| {
            rows.iter()
                .find(|r| r.user_id == user_id)
                .map(|r| role_from_db(r.role_id))
                .transpose()
        };

        let target_role =
            role_of(target)?.ok_or_else(|| AppError::not_found("User is not a member"))?;

        Ok(LockedMembership {
            owner_id,
            actor: caller.resolve(owner_id, role_of(caller.user_id)?),
            target: Target {
                user_id: target,
                role: MemberRole::resolve(target_role, target == owner_id),
            },
        })
    }

    pub async fn change_member_role(
        &self,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
        new_role: Role,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;
        let locked = Self::lock_membership(&mut tx, tenant_id, caller, target).await?;
        member_policy::ensure_can_change_role(locked.actor, locked.target, new_role)?;

        sqlx::query!(
            r#"UPDATE user_roles SET role_id = $1 WHERE user_id = $2 AND tenant_id = $3"#,
            new_role.db_id_i32(),
            target,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::MemberRoleChanged)
            .user(target)
            .actor(caller.user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "previousRole": locked.target.role, "newRole": new_role }))
            .record(&mut *tx)
            .await?;

        // Only members with the user role can be muted, so a promotion lifts
        // the mute instead of leaving a moderator who cannot moderate.
        if new_role != Role::User {
            Self::lift_mute(
                &mut tx,
                MuteLift {
                    tenant_id,
                    target,
                    actor: caller.user_id,
                    reason: UnmuteReason::Promoted,
                },
                client,
            )
            .await?;
        }

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    /// A no-op for a member who is already muted.
    pub async fn mute_member(
        &self,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;
        let locked = Self::lock_membership(&mut tx, tenant_id, caller, target).await?;
        member_policy::ensure_can_mute(locked.actor, locked.target)?;

        let muted = sqlx::query!(
            r#"INSERT INTO group_mutes (tenant_id, user_id, muted_by) VALUES ($1, $2, $3)
               ON CONFLICT (tenant_id, user_id) DO NOTHING"#,
            tenant_id,
            target,
            caller.user_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected()
            > 0;

        if muted {
            SecurityEvent::new(SecurityEventKind::MemberMuted)
                .user(target)
                .actor(caller.user_id)
                .tenant(tenant_id)
                .client(client)
                .record(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        Ok(())
    }

    /// A no-op for a member who is not muted.
    pub async fn unmute_member(
        &self,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;
        let locked = Self::lock_membership(&mut tx, tenant_id, caller, target).await?;
        member_policy::ensure_can_mute(locked.actor, locked.target)?;

        Self::lift_mute(
            &mut tx,
            MuteLift {
                tenant_id,
                target,
                actor: caller.user_id,
                reason: UnmuteReason::Unmuted,
            },
            client,
        )
        .await?;

        tx.commit().await?;

        Ok(())
    }

    async fn lift_mute(
        tx: &mut PgConnection,
        lift: MuteLift,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let lifted = sqlx::query!(
            r#"DELETE FROM group_mutes WHERE tenant_id = $1 AND user_id = $2"#,
            lift.tenant_id,
            lift.target
        )
        .execute(&mut *tx)
        .await?
        .rows_affected()
            > 0;

        if lifted {
            SecurityEvent::new(SecurityEventKind::MemberUnmuted)
                .user(lift.target)
                .actor(lift.actor)
                .tenant(lift.tenant_id)
                .client(client)
                .metadata(json!({ "reason": lift.reason }))
                .record(&mut *tx)
                .await?;
        }

        Ok(())
    }

    pub async fn remove_member(
        &self,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
        ban: bool,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;
        let locked = Self::lock_membership(&mut tx, tenant_id, caller, target).await?;
        member_policy::ensure_can_remove(locked.actor, locked.target)?;

        sqlx::query!(
            r#"DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2"#,
            target,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        if ban {
            sqlx::query!(
                r#"INSERT INTO group_bans (user_id, tenant_id, banned_by)
                   VALUES ($1, $2, $3)"#,
                target,
                tenant_id,
                caller.user_id
            )
            .execute(&mut *tx)
            .await?;
        }

        SecurityEvent::new(SecurityEventKind::MemberRemoved)
            .user(target)
            .actor(caller.user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "banned": ban }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    /// The previous owner always stays in the group as an admin.
    pub async fn transfer_ownership(
        &self,
        tenant_id: Uuid,
        caller: Caller,
        target: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;
        let locked = Self::lock_membership(&mut tx, tenant_id, caller, target).await?;
        member_policy::ensure_can_transfer_ownership(locked.actor, locked.target)?;
        let previous_owner = locked.owner_id;

        sqlx::query!(
            r#"UPDATE groups SET owner_id = $1 WHERE id = $2"#,
            target,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        // The owner's own role row is never consulted for rights, so both
        // sides of the handover simply hold admin.
        sqlx::query!(
            r#"UPDATE user_roles SET role_id = $1
               WHERE tenant_id = $2 AND user_id = ANY($3)"#,
            Role::Admin.db_id_i32(),
            tenant_id,
            &[previous_owner, target][..]
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::OwnershipTransferred)
            .user(target)
            .actor(caller.user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "previousOwnerId": previous_owner }))
            .record(&mut *tx)
            .await?;

        Self::lift_mute(
            &mut tx,
            MuteLift {
                tenant_id,
                target,
                actor: caller.user_id,
                reason: UnmuteReason::Promoted,
            },
            client,
        )
        .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn rename_group(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        name: Option<&DisplayName>,
        avatar_id: Option<Option<Uuid>>,
        group_type: Option<GroupType>,
        dalton_enabled: Option<bool>,
    ) -> AppResult<Value> {
        if let Some(enabled) = dalton_enabled {
            let mut tx = self.db.begin().await?;

            sqlx::query!(
                r#"UPDATE groups SET dalton_enabled = $1 WHERE id = $2"#,
                enabled,
                tenant_id
            )
            .execute(&mut *tx)
            .await?;

            // The pseudo-subject disappears with the setting, so its lessons
            // cannot outlive it. Dalton subject flags stay for a re-enable.
            if !enabled {
                sqlx::query!(
                    r#"DELETE FROM schedules WHERE tenant_id = $1 AND is_dalton"#,
                    tenant_id
                )
                .execute(&mut *tx)
                .await?;
            }

            tx.commit().await?;
        }

        if let Some(gt) = group_type {
            sqlx::query!(
                r#"UPDATE groups SET group_type = $1 WHERE id = $2"#,
                gt.as_str(),
                tenant_id
            )
            .execute(&self.db)
            .await?;
        }

        if let Some(name) = name {
            sqlx::query!(
                r#"UPDATE groups SET name = $1 WHERE id = $2"#,
                name.as_str(),
                tenant_id
            )
            .execute(&self.db)
            .await?;
        }

        if let Some(avatar_id) = avatar_id {
            let mut tx = self.db.begin().await?;

            // The previous picture is left to the asset sweep.
            if let Some(avatar_id) = avatar_id {
                ensure_claimable(&mut *tx, avatar_id, AssetPurpose::GroupAvatar, user_id).await?;
            }
            sqlx::query!(
                r#"UPDATE groups SET avatar_id = $1 WHERE id = $2"#,
                avatar_id,
                tenant_id
            )
            .execute(&mut *tx)
            .await
            .map_err(avatar_in_use_on_conflict)?;

            tx.commit().await?;
        }

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta)
               VALUES ($1, 'group-admin:rename', $2)"#,
            user_id,
            json!({
                "name": name.map(DisplayName::as_str),
                "avatarId": avatar_id,
                "groupType": group_type.map(GroupType::as_str),
                "daltonEnabled": dalton_enabled,
            })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn get_permissions(&self, tenant_id: Uuid) -> AppResult<Value> {
        let group = sqlx::query!(r#"SELECT permissions FROM groups WHERE id = $1"#, tenant_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::not_found("Group not found"))?;

        let perms = GroupPermissions::from_json_with_defaults(&group.permissions);
        Ok(json!({ "permissions": perms }))
    }

    pub async fn update_permissions(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        changes: &BTreeMap<Permission, Role>,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        // Locked, so two concurrent changes cannot each merge into the same
        // stale permissions and drop the other's.
        let group = sqlx::query!(
            r#"SELECT permissions FROM groups WHERE id = $1 FOR UPDATE"#,
            tenant_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Group not found"))?;

        let mut merged = GroupPermissions::from_json_with_defaults(&group.permissions);
        for (&permission, &role) in changes {
            merged.set_required_role(permission, role);
        }
        let merged_json = json!(merged);

        sqlx::query!(
            r#"UPDATE groups SET permissions = $1 WHERE id = $2"#,
            merged_json,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::PermissionsChanged)
            .actor(user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "changes": changes, "permissions": merged_json }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "permissions": merged_json }))
    }

    pub async fn delete_group(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        // Everything in the group cascades with it; the asset sweep deletes
        // the files its items and avatar leave behind.
        let name = sqlx::query_scalar!(
            r#"DELETE FROM groups WHERE id = $1 RETURNING name"#,
            tenant_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Group not found"))?;

        SecurityEvent::new(SecurityEventKind::GroupDeleted)
            .actor(user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "groupName": name }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn get_subjects(&self, tenant_id: Uuid) -> AppResult<Value> {
        let rows = sqlx::query!(
            r#"SELECT s.id, s.name, s.category, s.is_dalton,
                      COALESCE(
                          json_agg(json_build_object('id', c.id, 'name', c.name, 'courseType', c.course_type) ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL),
                          '[]'::json
                      ) as "courses!"
               FROM subjects s
               LEFT JOIN courses c ON c.subject_id = s.id
               WHERE s.tenant_id = $1
               GROUP BY s.id ORDER BY s.name"#,
            tenant_id
        )
            .fetch_all(&self.db)
            .await?;

        Ok(json!(
            rows.into_iter()
                .map(|s| json!({
                    "id": s.id,
                    "name": s.name,
                    "category": s.category,
                    "isDalton": s.is_dalton,
                    "courses": s.courses,
                }))
                .collect::<Vec<_>>()
        ))
    }

    pub async fn create_subject(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        name: &DisplayName,
        category: Option<&str>,
        is_dalton: bool,
    ) -> AppResult<Value> {
        let group_type = self.group_type(tenant_id).await?;
        let cat = category.unwrap_or(default_category(group_type));
        validate_category(group_type, cat)?;

        let row = sqlx::query!(
            r#"INSERT INTO subjects (tenant_id, name, category, is_dalton) VALUES ($1, $2, $3, $4)
               RETURNING id, name, category, is_dalton"#,
            tenant_id,
            name.as_str(),
            cat,
            is_dalton
        )
        .fetch_one(&self.db)
        .await
        .map_err(|e| AppError::name_taken_on_conflict(e, SUBJECT_NAME_TAKEN))?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta)
               VALUES ($1, 'group-admin:subject:create', $2)"#,
            user_id,
            json!({ "subjectId": row.id })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({
            "id": row.id,
            "name": row.name,
            "category": row.category,
            "isDalton": row.is_dalton,
        }))
    }

    /// Keeps the courses of a subject consistent with its category: a
    /// Zusatzkurs subject makes all of them ZK, a regular group strips the type
    /// entirely, and any other Abitur subject keeps the GK/LK picks it already
    /// has while giving untyped courses the default.
    async fn realign_course_types(
        &self,
        subject_id: Uuid,
        group_type: GroupType,
        category: &str,
    ) -> AppResult<()> {
        if !group_type.uses_course_types() {
            sqlx::query!(
                r#"UPDATE courses SET course_type = NULL
                   WHERE subject_id = $1 AND course_type IS NOT NULL"#,
                subject_id
            )
            .execute(&self.db)
            .await?;

            return Ok(());
        }

        if category == ZUSATZKURS_CATEGORY {
            sqlx::query!(
                r#"UPDATE courses SET course_type = 'zk'
                   WHERE subject_id = $1 AND course_type IS DISTINCT FROM 'zk'"#,
                subject_id
            )
            .execute(&self.db)
            .await?;

            return Ok(());
        }

        sqlx::query!(
            r#"UPDATE courses SET course_type = $2
               WHERE subject_id = $1 AND (course_type IS NULL OR course_type = 'zk')"#,
            subject_id,
            DEFAULT_COURSE_TYPE
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn update_subject(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        id: Uuid,
        name: Option<&DisplayName>,
        category: Option<&str>,
        is_dalton: Option<bool>,
    ) -> AppResult<Value> {
        sqlx::query!(
            r#"SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2"#,
            id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Subject not found"))?;

        if let Some(cat) = category {
            let group_type = self.group_type(tenant_id).await?;
            validate_category(group_type, cat)?;
            sqlx::query!(
                r#"UPDATE subjects SET category = $1 WHERE id = $2"#,
                cat,
                id
            )
            .execute(&self.db)
            .await?;

            self.realign_course_types(id, group_type, cat).await?;
        }

        if let Some(n) = name {
            sqlx::query!(
                r#"UPDATE subjects SET name = $1 WHERE id = $2"#,
                n.as_str(),
                id
            )
            .execute(&self.db)
            .await
            .map_err(|e| AppError::name_taken_on_conflict(e, SUBJECT_NAME_TAKEN))?;
        }

        if let Some(flag) = is_dalton {
            sqlx::query!(
                r#"UPDATE subjects SET is_dalton = $1 WHERE id = $2"#,
                flag,
                id
            )
            .execute(&self.db)
            .await?;
        }

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta)
               VALUES ($1, 'group-admin:subject:update', $2)"#,
            user_id,
            json!({ "subjectId": id })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn delete_subject(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        id: Uuid,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        // The row lock makes lessons, courses and tasks that would reference
        // the subject wait until it is gone, so the check below cannot go stale.
        let subject = sqlx::query!(
            r#"SELECT name,
                      EXISTS (SELECT 1 FROM schedules WHERE subject_id = s.id)
                          OR EXISTS (SELECT 1 FROM courses WHERE subject_id = s.id) AS "referenced!"
               FROM subjects s
               WHERE id = $1 AND tenant_id = $2
               FOR UPDATE"#,
            id,
            tenant_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Subject not found"))?;

        if subject.referenced {
            return Err(AppError::bad_request(
                "Subject is still referenced. Delete the referencing schedules or courses first.",
            ));
        }

        // Tasks outlive their subject: they keep its name as a custom label.
        sqlx::query!(
            r#"UPDATE items
               SET custom_subject = $2, subject_id = NULL, course_id = NULL
               WHERE subject_id = $1"#,
            id,
            subject.name
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(r#"DELETE FROM subjects WHERE id = $1"#, id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta)
               VALUES ($1, 'group-admin:subject:delete', $2)"#,
            user_id,
            json!({ "subjectId": id })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn replace_schedule(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        dto: ReplaceScheduleDto,
    ) -> AppResult<Value> {
        if NaiveTime::parse_from_str(&dto.schedule_config.start_time, "%H:%M").is_err() {
            return Err(AppError::bad_request(
                "Start time must use the HH:MM format.",
            ));
        }

        if !(1..=15).contains(&dto.schedule_config.total_slots) {
            return Err(AppError::bad_request(
                "The schedule must contain between 1 and 15 slots.",
            ));
        }

        if !(10..=120).contains(&dto.schedule_config.lesson_duration_mins) {
            return Err(AppError::bad_request(
                "Lesson duration must be between 10 and 120 minutes.",
            ));
        }

        validate_breaks(&dto.schedule_config)?;

        if dto.lessons.len() > 250 {
            return Err(AppError::bad_request(
                "A schedule may not contain more than 250 lessons.",
            ));
        }

        let mut lesson_ids = HashSet::new();
        let mut references = Vec::with_capacity(dto.lessons.len());
        let mut has_dalton = false;

        for lesson in &dto.lessons {
            if !(1..=5).contains(&lesson.day) || lesson.slot < 1 || lesson.duration < 1 {
                return Err(AppError::bad_request(
                    "Every lesson must fit within the configured school week.",
                ));
            }

            let end_slot = lesson
                .slot
                .checked_add(lesson.duration - 1)
                .ok_or_else(|| {
                    AppError::bad_request(
                        "Every lesson must fit within the configured school week.",
                    )
                })?;

            if end_slot > dto.schedule_config.total_slots {
                return Err(AppError::bad_request(
                    "Every lesson must fit within the configured school week.",
                ));
            }

            if lesson.room.as_deref().is_some_and(|room| room.len() > 100) {
                return Err(AppError::bad_request(
                    "Room names may not exceed 100 characters.",
                ));
            }

            if let Some(id) = lesson.id
                && !lesson_ids.insert(id)
            {
                return Err(AppError::bad_request(
                    "Duplicate lesson IDs are not allowed.",
                ));
            }

            validate_dalton_lesson(lesson.is_dalton, lesson.subject_id, lesson.course_id)?;
            has_dalton |= lesson.is_dalton;

            references.push((lesson.subject_id, lesson.course_id));
        }

        if has_dalton {
            self.ensure_dalton_enabled(tenant_id).await?;
        }

        let lesson_ids: Vec<_> = lesson_ids.into_iter().collect();
        if !lesson_ids.is_empty() {
            let existing_count = sqlx::query_scalar!(
                r#"SELECT COUNT(*) FROM schedules WHERE tenant_id = $1 AND id = ANY($2)"#,
                tenant_id,
                &lesson_ids
            )
            .fetch_one(&self.db)
            .await?
            .unwrap_or(0);

            if existing_count != lesson_ids.len() as i64 {
                return Err(AppError::bad_request(
                    "An existing lesson does not belong to this group.",
                ));
            }
        }

        self.validate_lesson_references(tenant_id, &references)
            .await?;

        let schedule_config = serde_json::to_value(&dto.schedule_config)
            .map_err(|_| AppError::internal("Failed to serialize the schedule configuration."))?;
        let lessons = LessonColumns::from(dto.lessons);

        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"UPDATE groups SET schedule_config = $1 WHERE id = $2"#,
            schedule_config,
            tenant_id
        )
        .execute(&mut *tx)
        .await?;

        // Lessons are synced instead of deleted and re-created: substitutions
        // cascade from their lesson, so only lessons that really left the
        // schedule may take theirs with them.
        sqlx::query!(
            r#"DELETE FROM schedules WHERE tenant_id = $1 AND NOT (id = ANY($2))"#,
            tenant_id,
            &lessons.ids
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO schedules (id, tenant_id, day, slot, duration, room, subject_id, course_id, is_dalton)
               SELECT t.id, $1, t.day, t.slot, t.duration, t.room, t.subject_id, t.course_id, t.is_dalton
               FROM UNNEST($2::uuid[], $3::int4[], $4::int4[], $5::int4[], $6::text[], $7::uuid[], $8::uuid[], $9::bool[])
                    AS t(id, day, slot, duration, room, subject_id, course_id, is_dalton)
               ON CONFLICT (id) DO UPDATE SET
                 day = EXCLUDED.day,
                 slot = EXCLUDED.slot,
                 duration = EXCLUDED.duration,
                 room = EXCLUDED.room,
                 subject_id = EXCLUDED.subject_id,
                 course_id = EXCLUDED.course_id,
                 is_dalton = EXCLUDED.is_dalton
               WHERE schedules.tenant_id = EXCLUDED.tenant_id
                 AND (schedules.day, schedules.slot, schedules.duration, schedules.room,
                      schedules.subject_id, schedules.course_id, schedules.is_dalton)
                     IS DISTINCT FROM
                     (EXCLUDED.day, EXCLUDED.slot, EXCLUDED.duration, EXCLUDED.room,
                      EXCLUDED.subject_id, EXCLUDED.course_id, EXCLUDED.is_dalton)"#,
            tenant_id,
            &lessons.ids,
            &lessons.days,
            &lessons.slots,
            &lessons.durations,
            &lessons.rooms as &[Option<String>],
            &lessons.subject_ids as &[Option<Uuid>],
            &lessons.course_ids as &[Option<Uuid>],
            &lessons.is_dalton
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta)
               VALUES ($1, 'group-admin:schedule:replace', $2)"#,
            user_id,
            json!({ "tenantId": tenant_id })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }

    /// Gives the lesson its change for one week, replacing the one it had
    /// that week, so a lesson never shows up more than once on the schedule.
    pub async fn save_schedule_sub(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        dto: ScheduleSubDto,
    ) -> AppResult<Value> {
        let dto = validate_schedule_sub(dto)?;
        self.validate_sub_target(tenant_id, dto.lesson_id, dto.course_id)
            .await?;

        let day_str = dto.day.map(|d| d.to_string());

        let mut tx = self.db.begin().await?;

        // The conflict guard keeps a change of another group untouched, even
        // though the lesson was already checked to belong to this one.
        let row = sqlx::query!(
            r#"INSERT INTO schedule_subs
                (tenant_id, lesson_id, week_start, course_id, day, slot, duration, subject, room, cancelled)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (lesson_id, week_start) DO UPDATE SET
                 course_id = EXCLUDED.course_id,
                 day = EXCLUDED.day,
                 slot = EXCLUDED.slot,
                 duration = EXCLUDED.duration,
                 subject = EXCLUDED.subject,
                 room = EXCLUDED.room,
                 cancelled = EXCLUDED.cancelled
               WHERE schedule_subs.tenant_id = EXCLUDED.tenant_id
               RETURNING id, created_at, (xmax = 0) AS "created!""#,
            tenant_id,
            dto.lesson_id,
            dto.week_start.monday(),
            dto.course_id,
            day_str.as_deref(),
            dto.slot,
            dto.duration,
            dto.subject,
            dto.room,
            dto.cancelled.unwrap_or(false)
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Lesson not found"))?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, $2, $3)"#,
            user_id,
            if row.created {
                "schedule:sub:create"
            } else {
                "schedule:sub:update"
            },
            json!({ "lessonId": dto.lesson_id, "weekStart": dto.week_start, "courseId": dto.course_id })
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(json!({
            "id": row.id, "lessonId": dto.lesson_id, "weekStart": dto.week_start,
            "courseId": dto.course_id, "day": dto.day,
            "slot": dto.slot, "duration": dto.duration, "subject": dto.subject, "room": dto.room,
            "cancelled": dto.cancelled.unwrap_or(false), "createdAt": row.created_at,
        }))
    }

    /// A substitution may only target a lesson of this group, and a course
    /// only when that lesson is taught to it: either the lesson belongs to the
    /// course itself or the course is one of the lesson's subject.
    async fn validate_sub_target(
        &self,
        tenant_id: Uuid,
        lesson_id: Uuid,
        course_id: Option<Uuid>,
    ) -> AppResult<()> {
        let target = sqlx::query!(
            r#"SELECT s.subject_id, s.course_id AS lesson_course_id,
                      c.subject_id AS "course_subject_id?"
               FROM schedules s
               LEFT JOIN courses c ON c.id = $3 AND c.tenant_id = s.tenant_id
               WHERE s.id = $1 AND s.tenant_id = $2"#,
            lesson_id,
            tenant_id,
            course_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Lesson not found"))?;

        let Some(course_id) = course_id else {
            return Ok(());
        };

        let course_fits = match target.lesson_course_id {
            Some(lesson_course_id) => lesson_course_id == course_id,
            None => target
                .course_subject_id
                .is_some_and(|course_subject| target.subject_id == Some(course_subject)),
        };

        if course_fits {
            Ok(())
        } else {
            Err(AppError::bad_request(
                "The course does not take part in this lesson.",
            ))
        }
    }

    pub async fn delete_schedule_sub(&self, tenant_id: Uuid, id: Uuid) -> AppResult<Value> {
        sqlx::query!(
            r#"DELETE FROM schedule_subs WHERE id = $1 AND tenant_id = $2"#,
            id,
            tenant_id
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true }))
    }

    /// The type a course of this subject has to get, which only a GK/LK subject
    /// in an Abitur group leaves up to the client.
    async fn course_type_for_subject(
        &self,
        tenant_id: Uuid,
        subject_id: Uuid,
        requested: Option<&str>,
    ) -> AppResult<Option<&'static str>> {
        let category = sqlx::query_scalar!(
            r#"SELECT category FROM subjects WHERE id = $1 AND tenant_id = $2"#,
            subject_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Subject not found"))?;

        let group_type = self.group_type(tenant_id).await?;
        resolve_course_type(group_type, &category, requested).map_err(AppError::bad_request)
    }

    pub async fn create_course(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        subject_id: Uuid,
        name: &DisplayName,
        course_type: Option<&str>,
    ) -> AppResult<Value> {
        let course_type = self
            .course_type_for_subject(tenant_id, subject_id, course_type)
            .await?;

        let row = sqlx::query!(
            "INSERT INTO courses (tenant_id, name, subject_id, course_type) VALUES ($1, $2, $3, $4) RETURNING id, name, subject_id, course_type",
            tenant_id,
            name.as_str(),
            subject_id,
            course_type
        )
        .fetch_one(&self.db)
        .await
        .map_err(|e| AppError::name_taken_on_conflict(e, COURSE_NAME_TAKEN))?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, $2, $3)"#,
            user_id,
            "group-admin:course:create",
            json!({ "courseId": row.id, "subjectId": subject_id })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({
            "id": row.id,
            "name": row.name,
            "subjectId": row.subject_id,
            "courseType": row.course_type
        }))
    }

    pub async fn update_course(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        course_id: Uuid,
        name: &DisplayName,
        course_type: Option<&str>,
    ) -> AppResult<Value> {
        let course = sqlx::query!(
            r#"SELECT subject_id, course_type FROM courses WHERE id = $1 AND tenant_id = $2"#,
            course_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Course not found"))?;

        // A request that only renames the course keeps the type it has. A stale
        // 'zk' under a GK/LK subject is not a valid pick, so it falls back.
        let requested = course_type.or(course
            .course_type
            .as_deref()
            .filter(|t| *t != ZUSATZKURS_CATEGORY));
        let course_type = self
            .course_type_for_subject(tenant_id, course.subject_id, requested)
            .await?;

        sqlx::query!(
            r#"UPDATE courses SET name = $1, course_type = $2 WHERE id = $3"#,
            name.as_str(),
            course_type,
            course_id
        )
        .execute(&self.db)
        .await
        .map_err(|e| AppError::name_taken_on_conflict(e, COURSE_NAME_TAKEN))?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, $2, $3)"#,
            user_id,
            "group-admin:course:update",
            json!({ "courseId": course_id, "name": name.as_str() })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true, "courseType": course_type }))
    }

    pub async fn delete_course(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        course_id: Uuid,
    ) -> AppResult<Value> {
        let rows = sqlx::query!(
            r#"DELETE FROM courses WHERE id = $1 AND tenant_id = $2"#,
            course_id,
            tenant_id
        )
        .execute(&self.db)
        .await?;
        if rows.rows_affected() == 0 {
            return Err(AppError::not_found("Course not found"));
        }

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, $2, $3)"#,
            user_id,
            "group-admin:course:delete",
            json!({ "courseId": course_id })
        )
        .execute(&self.db)
        .await?;

        Ok(json!({ "ok": true }))
    }

    pub async fn get_invites(&self, tenant_id: Uuid) -> AppResult<Value> {
        let rows = sqlx::query!(
            r#"SELECT id, token, created_by, created_at, expires_at, used_at, used_by, revoked_at, revoked_by
               FROM group_invites
               WHERE tenant_id = $1
               ORDER BY created_at DESC"#,
            tenant_id
        )
            .fetch_all(&self.db)
            .await?;

        let now = chrono::Utc::now();
        let invites: Vec<Value> = rows
            .into_iter()
            .map(|r| {
                // Spent tokens are useless to admins, so they are not handed out again.
                let is_active = r.used_at.is_none() && r.revoked_at.is_none() && r.expires_at > now;
                let created_by_name = r
                    .created_by
                    .map(|uid| crate::common::name_generator::generate_user_name(&uid.to_string()));
                let used_by_name = r
                    .used_by
                    .map(|uid| crate::common::name_generator::generate_user_name(&uid.to_string()));
                let revoked_by_name = r
                    .revoked_by
                    .map(|uid| crate::common::name_generator::generate_user_name(&uid.to_string()));

                json!({
                    "id": r.id,
                    "token": is_active.then_some(r.token),
                    "createdBy": r.created_by,
                    "createdByName": created_by_name,
                    "createdAt": r.created_at,
                    "expiresAt": r.expires_at,
                    "usedAt": r.used_at,
                    "usedBy": r.used_by,
                    "usedByName": used_by_name,
                    "revokedAt": r.revoked_at,
                    "revokedBy": r.revoked_by,
                    "revokedByName": revoked_by_name,
                })
            })
            .collect();

        Ok(json!(invites))
    }

    pub async fn revoke_invite(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        invite_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        let rows_affected = sqlx::query!(
            r#"UPDATE group_invites
               SET revoked_at = now(), revoked_by = $1
               WHERE id = $2 AND tenant_id = $3 AND revoked_at IS NULL AND used_at IS NULL"#,
            user_id,
            invite_id,
            tenant_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::bad_request(
                "Invite not found or already used/revoked.",
            ));
        }

        SecurityEvent::new(SecurityEventKind::InviteRevoked)
            .actor(user_id)
            .tenant(tenant_id)
            .client(client)
            .metadata(json!({ "inviteId": invite_id }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::school_week::WeekStart;

    #[test]
    fn dalton_lessons_cannot_point_at_a_subject_or_course() {
        let id = Some(Uuid::nil());

        assert!(validate_dalton_lesson(true, None, None).is_ok());
        assert!(validate_dalton_lesson(true, id, None).is_err());
        assert!(validate_dalton_lesson(true, None, id).is_err());
        assert!(validate_dalton_lesson(false, id, id).is_ok());
    }

    fn sub(day: Option<i32>, room: Option<&str>) -> ScheduleSubDto {
        ScheduleSubDto {
            lesson_id: Uuid::nil(),
            week_start: chrono::NaiveDate::from_ymd_opt(2026, 10, 5)
                .and_then(|monday| WeekStart::try_from(monday).ok())
                .unwrap(),
            course_id: None,
            day,
            slot: Some(1),
            duration: Some(1),
            subject: None,
            room: room.map(str::to_owned),
            cancelled: None,
        }
    }

    fn config(breaks: &[(i32, i32)], day_breaks: &[(i32, &[(i32, i32)])]) -> ScheduleConfigDto {
        ScheduleConfigDto {
            start_time: "08:00".to_owned(),
            total_slots: 6,
            lesson_duration_mins: 45,
            breaks: breaks.iter().copied().collect(),
            day_breaks: day_breaks
                .iter()
                .map(|(day, breaks)| (*day, breaks.iter().copied().collect()))
                .collect(),
        }
    }

    #[test]
    fn breaks_follow_a_slot_and_last_a_bounded_time() {
        assert!(validate_breaks(&config(&[(2, 20), (4, 10)], &[])).is_ok());
        assert!(validate_breaks(&config(&[(0, 20)], &[])).is_err());
        assert!(validate_breaks(&config(&[(7, 20)], &[])).is_err());
        assert!(validate_breaks(&config(&[(2, 0)], &[])).is_err());
        assert!(validate_breaks(&config(&[(2, 181)], &[])).is_err());
    }

    #[test]
    fn only_school_days_have_breaks_of_their_own() {
        assert!(validate_breaks(&config(&[(2, 20)], &[(3, &[(1, 20)]), (5, &[])])).is_ok());
        assert!(validate_breaks(&config(&[], &[(6, &[(2, 20)])])).is_err());
        assert!(validate_breaks(&config(&[], &[(0, &[(2, 20)])])).is_err());
        assert!(validate_breaks(&config(&[], &[(3, &[(7, 20)])])).is_err());
    }

    #[test]
    fn substitutions_stay_within_the_school_week() {
        assert!(validate_schedule_sub(sub(Some(5), None)).is_ok());
        assert!(validate_schedule_sub(sub(None, None)).is_ok());
        assert!(validate_schedule_sub(sub(Some(6), None)).is_err());
        assert!(validate_schedule_sub(sub(Some(0), None)).is_err());
    }

    #[test]
    fn substitution_texts_are_bounded() {
        let long = "x".repeat(MAX_SCHEDULE_TEXT_CHARS + 1);
        assert!(validate_schedule_sub(sub(None, Some(&long))).is_err());
    }

    #[test]
    fn substitution_texts_are_trimmed() {
        let saved = validate_schedule_sub(sub(None, Some("  R101 "))).unwrap();
        assert_eq!(saved.room.as_deref(), Some("R101"));
    }

    #[test]
    fn substitutions_have_to_change_the_lesson() {
        let unchanged = || ScheduleSubDto {
            slot: None,
            duration: None,
            ..sub(None, Some("   "))
        };
        assert!(validate_schedule_sub(unchanged()).is_err());
        assert!(
            validate_schedule_sub(ScheduleSubDto {
                cancelled: Some(false),
                ..unchanged()
            })
            .is_err()
        );
        assert!(
            validate_schedule_sub(ScheduleSubDto {
                cancelled: Some(true),
                ..unchanged()
            })
            .is_ok()
        );
    }
}
