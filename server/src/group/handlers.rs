use super::{dto::*, invite_token::InviteToken, service::GroupService};
use crate::{
    common::client::ClientInfo,
    common::extractors::{AuthUser, OptionalAuth, TenantContext, ValidatedJson},
    common::group_type::GroupType,
    common::names::{
        COURSE_NAME_MAX_CHARS, DisplayName, GROUP_NAME_MAX_CHARS, SUBJECT_NAME_MAX_CHARS,
    },
    common::path_params::{IdPath, MemberPath, SubjectPath},
    common::role::Role,
    error::{AppError, AppResult},
    schedule::{dto::ScheduleSubsQuery, service::ScheduleService},
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};

use super::{admin::service::GroupAdminService, member_policy::Caller};
use crate::group::dto::ScheduleSubDto;

pub async fn create_invite(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::InviteMembers);

    let body = GroupService::from_state(&s)
        .create_invite(tc.tenant_id, tc.user.user_id, &client)
        .await?;

    Ok(Json(body))
}

pub async fn get_invite(
    State(s): State<AppState>,
    OptionalAuth(user): OptionalAuth,
    Path(token): Path<String>,
) -> AppResult<Json<Value>> {
    let token: InviteToken = token.parse()?;
    let body = GroupService::from_state(&s)
        .get_invite(&token, user.map(|u| u.user_id))
        .await?;

    Ok(Json(body))
}

pub async fn accept_invite(
    State(s): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Path(token): Path<String>,
) -> AppResult<Json<Value>> {
    let token: InviteToken = token.parse()?;
    let body = GroupService::from_state(&s)
        .accept_invite(crate::group::service::AcceptInviteParams {
            user_id: user.user_id,
            token: &token,
            client: &client,
        })
        .await?;

    Ok(Json(body))
}

/// Rejects unknown group types instead of silently storing a regular group.
fn parse_group_type(raw: Option<&str>) -> AppResult<Option<GroupType>> {
    raw.map(|value| {
        GroupType::from_str(value)
            .ok_or_else(|| AppError::bad_request("Unknown group type. Use 'regular' or 'abitur'."))
    })
    .transpose()
}

pub async fn create_group(
    State(s): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Json(dto): Json<CreateGroupDto>,
) -> AppResult<Json<Value>> {
    let group_name = DisplayName::parse(&dto.group_name, GROUP_NAME_MAX_CHARS, "groupName")?;
    let group_type = parse_group_type(dto.group_type.as_deref())?.unwrap_or_default();

    let body = GroupService::from_state(&s)
        .create_group(crate::group::service::CreateGroupParams {
            user_id: user.user_id,
            group_name: &group_name,
            avatar_id: dto.avatar_id,
            group_type,
            dalton_enabled: dto.dalton_enabled,
            client: &client,
        })
        .await?;

    Ok(Json(body))
}

pub async fn get_status(
    State(s): State<AppState>,
    OptionalAuth(user): OptionalAuth,
) -> AppResult<Json<GroupStatusDto>> {
    Ok(Json(
        GroupService::from_state(&s)
            .get_status(user.map(|u| u.user_id))
            .await?,
    ))
}

pub async fn get_group(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<GroupSummaryDto>> {
    Ok(Json(GroupService::from_state(&s).get_group(&tc).await?))
}

pub async fn record_visit(State(s): State<AppState>, tc: TenantContext) -> AppResult<StatusCode> {
    GroupService::from_state(&s)
        .record_visit(tc.user.user_id, tc.tenant_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn leave_group(State(s): State<AppState>, tc: TenantContext) -> AppResult<Json<Value>> {
    GroupService::from_state(&s)
        .leave_group(tc.user.user_id, tc.tenant_id)
        .await?;

    Ok(Json(json!({ "ok": true })))
}

/// Every member may see who else is in the group; only the pseudonyms are
/// exposed, never emails.
pub async fn get_members(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Vec<GroupMemberDto>>> {
    Ok(Json(
        GroupService::from_state(&s)
            .list_members(tc.tenant_id, Caller::from_tenant(&tc))
            .await?,
    ))
}

pub async fn get_banned_users(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::ModerateMembers);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_banned_users(tc.tenant_id)
            .await?,
    ))
}

pub async fn revert_ban(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::ModerateMembers);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .revert_ban(tc.tenant_id, tc.user.user_id, target, &client)
            .await?,
    ))
}

pub async fn change_member_role(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
    Json(dto): Json<ChangeMemberRoleDto>,
) -> AppResult<Json<Value>> {
    let role = Role::from_str(&dto.role).ok_or_else(|| AppError::bad_request("Invalid role"))?;

    Ok(Json(
        GroupAdminService::from_state(&s)
            .change_member_role(
                tc.tenant_id,
                Caller::from_tenant(&tc),
                target,
                role,
                &client,
            )
            .await?,
    ))
}

pub async fn transfer_ownership(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Json(dto): Json<TransferOwnershipDto>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        GroupAdminService::from_state(&s)
            .transfer_ownership(
                tc.tenant_id,
                Caller::from_tenant(&tc),
                dto.target_user_id,
                &client,
            )
            .await?,
    ))
}

pub async fn mute_member(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
) -> AppResult<StatusCode> {
    GroupAdminService::from_state(&s)
        .mute_member(tc.tenant_id, Caller::from_tenant(&tc), target, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn unmute_member(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
) -> AppResult<StatusCode> {
    GroupAdminService::from_state(&s)
        .unmute_member(tc.tenant_id, Caller::from_tenant(&tc), target, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct BanQuery {
    pub ban: Option<String>,
}

pub async fn remove_member(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
    Query(q): Query<BanQuery>,
) -> AppResult<Json<Value>> {
    let body = GroupAdminService::from_state(&s)
        .remove_member(
            tc.tenant_id,
            Caller::from_tenant(&tc),
            target,
            q.ban.as_deref() == Some("true"),
            &client,
        )
        .await?;

    Ok(Json(body))
}

pub async fn rename_group(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<RenameGroupDto>,
) -> AppResult<Json<Value>> {
    let name = dto
        .name
        .as_deref()
        .map(|name| DisplayName::parse(name, GROUP_NAME_MAX_CHARS, "name"))
        .transpose()?;
    let group_type = parse_group_type(dto.group_type.as_deref())?;

    let edits_profile = name.is_some() || dto.avatar_id.is_some();
    let edits_configuration = group_type.is_some() || dto.dalton_enabled.is_some();
    if !edits_profile && !edits_configuration {
        return Err(AppError::bad_request("Nothing to change."));
    }

    if edits_profile {
        crate::require_permission!(tc, crate::common::permission::Permission::EditGroupProfile);
    }
    if edits_configuration {
        crate::require_permission!(
            tc,
            crate::common::permission::Permission::EditGroupConfiguration
        );
    }

    Ok(Json(
        GroupAdminService::from_state(&s)
            .rename_group(
                tc.tenant_id,
                tc.user.user_id,
                name.as_ref(),
                dto.avatar_id,
                group_type,
                dto.dalton_enabled,
            )
            .await?,
    ))
}

pub async fn get_permissions(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Value>> {
    if !tc.has_owner_rights() {
        return Err(AppError::forbidden(
            "Only the group owner or superadmin can view permissions.",
        ));
    }
    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_permissions(tc.tenant_id)
            .await?,
    ))
}

pub async fn update_permissions(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<UpdateGroupPermissionsDto>,
) -> AppResult<Json<Value>> {
    if !tc.has_owner_rights() {
        return Err(AppError::forbidden(
            "Only the group owner or superadmin can change permissions.",
        ));
    }
    Ok(Json(
        GroupAdminService::from_state(&s)
            .update_permissions(tc.tenant_id, tc.user.user_id, &dto.permissions, &client)
            .await?,
    ))
}

pub async fn delete_group(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
) -> AppResult<Json<Value>> {
    if !tc.has_owner_rights() {
        return Err(AppError::forbidden(
            "Only the group owner or superadmin can delete this group.",
        ));
    }

    let body = GroupAdminService::from_state(&s)
        .delete_group(tc.tenant_id, tc.user.user_id, &client)
        .await?;

    Ok(Json(body))
}

pub async fn get_subjects_admin(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );

    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_subjects(tc.tenant_id)
            .await?,
    ))
}

pub async fn create_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<CreateSubjectDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    let name = DisplayName::parse(&dto.name, SUBJECT_NAME_MAX_CHARS, "name")?;
    Ok(Json(
        GroupAdminService::from_state(&s)
            .create_subject(
                tc.tenant_id,
                tc.user.user_id,
                &name,
                dto.category.as_deref(),
                dto.is_dalton,
            )
            .await?,
    ))
}

pub async fn update_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<UpdateSubjectDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    let name = dto
        .name
        .as_deref()
        .map(|n| DisplayName::parse(n, SUBJECT_NAME_MAX_CHARS, "name"))
        .transpose()?;
    Ok(Json(
        GroupAdminService::from_state(&s)
            .update_subject(
                tc.tenant_id,
                tc.user.user_id,
                id,
                name.as_ref(),
                dto.category.as_deref(),
                dto.is_dalton,
            )
            .await?,
    ))
}

pub async fn delete_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    Ok(Json(
        GroupAdminService::from_state(&s)
            .delete_subject(tc.tenant_id, tc.user.user_id, id)
            .await?,
    ))
}

pub async fn create_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(SubjectPath { subject_id }): Path<SubjectPath>,
    Json(dto): Json<CreateCourseDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    let name = DisplayName::parse(&dto.name, COURSE_NAME_MAX_CHARS, "name")?;
    Ok(Json(
        GroupAdminService::from_state(&s)
            .create_course(
                tc.tenant_id,
                tc.user.user_id,
                subject_id,
                &name,
                dto.course_type.as_deref(),
            )
            .await?,
    ))
}

pub async fn update_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<UpdateCourseDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    let name = DisplayName::parse(&dto.name, COURSE_NAME_MAX_CHARS, "name")?;
    Ok(Json(
        GroupAdminService::from_state(&s)
            .update_course(
                tc.tenant_id,
                tc.user.user_id,
                id,
                &name,
                dto.course_type.as_deref(),
            )
            .await?,
    ))
}

pub async fn delete_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::EditSubjectsCourses
    );
    Ok(Json(
        GroupAdminService::from_state(&s)
            .delete_course(tc.tenant_id, tc.user.user_id, id)
            .await?,
    ))
}

pub async fn get_schedule_admin(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Value>> {
    // Read-only for every member: /schedule already returns the whole
    // timetable to members without course personalization.
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_schedule(tc.tenant_id, None)
            .await?
            .lessons,
    ))
}

pub async fn replace_schedule_admin(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<ReplaceScheduleDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::EditSchedule);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .replace_schedule(tc.tenant_id, tc.user.user_id, dto)
            .await?,
    ))
}

pub async fn get_schedule_subs_admin(
    State(s): State<AppState>,
    tc: TenantContext,
    Query(weeks): Query<ScheduleSubsQuery>,
) -> AppResult<Json<Value>> {
    // Read-only for every member, like /schedule/subs.
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_subs(tc.tenant_id, weeks)
            .await?,
    ))
}

pub async fn save_schedule_sub(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<ScheduleSubDto>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::ManageScheduleChanges
    );

    Ok(Json(
        GroupAdminService::from_state(&s)
            .save_schedule_sub(tc.tenant_id, tc.user.user_id, dto)
            .await?,
    ))
}

pub async fn delete_schedule_sub(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(
        tc,
        crate::common::permission::Permission::ManageScheduleChanges
    );

    Ok(Json(
        GroupAdminService::from_state(&s)
            .delete_schedule_sub(tc.tenant_id, id)
            .await?,
    ))
}

pub async fn get_invites(State(s): State<AppState>, tc: TenantContext) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::ModerateMembers);
    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_invites(tc.tenant_id)
            .await?,
    ))
}

pub async fn revoke_invite(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(IdPath { id: invite_id }): Path<IdPath>,
) -> AppResult<Json<Value>> {
    crate::require_permission!(tc, crate::common::permission::Permission::ModerateMembers);
    Ok(Json(
        GroupAdminService::from_state(&s)
            .revoke_invite(tc.tenant_id, tc.user.user_id, invite_id, &client)
            .await?,
    ))
}
