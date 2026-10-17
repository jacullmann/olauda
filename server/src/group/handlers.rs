use super::{
    admin::service::GroupAdminService,
    dto::*,
    invite_token::InviteToken,
    member_policy::Caller,
    service::{AcceptInviteParams, CreateGroupParams, GroupService},
};
use crate::{
    common::{
        client::ClientInfo,
        created::CreatedDto,
        extractors::{AuthUser, OptionalAuth, TenantContext, ValidatedJson},
        names::{COURSE_NAME_MAX_CHARS, DisplayName, GROUP_NAME_MAX_CHARS, SUBJECT_NAME_MAX_CHARS},
        path_params::{IdPath, MemberPath, SubjectPath},
        permission::{GroupPermissions, Permission},
    },
    error::{AppError, AppResult},
    require_permission,
    schedule::{
        dto::{CourseDto, ScheduleDto, ScheduleSubsQuery, SubjectDto, SubstitutionDto},
        service::ScheduleService,
    },
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

/// Only the owner and superadmins may manage what decides everybody's rights.
fn require_owner_rights(tc: &TenantContext) -> AppResult<()> {
    if tc.has_owner_rights() {
        Ok(())
    } else {
        Err(AppError::forbidden(
            "Only the group owner or a superadmin can do this.",
        ))
    }
}

#[utoipa::path(
    post,
    path = "/invites",
    tag = "groups",
    responses((status = 201, body = InviteCreatedDto)),
)]
pub async fn create_invite(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
) -> AppResult<(StatusCode, Json<InviteCreatedDto>)> {
    require_permission!(tc, Permission::InviteMembers);

    let invite = GroupService::from_state(&s)
        .create_invite(tc.tenant_id, tc.user.user_id, &client)
        .await?;

    Ok((StatusCode::CREATED, Json(invite)))
}

/// What an invite link leads to; signing in is optional.
#[utoipa::path(
    get,
    path = "/invites/{token}",
    tag = "groups",
    params(("token" = String, Path)),
    responses((status = 200, body = InvitePreviewDto)),
)]
pub async fn get_invite(
    State(s): State<AppState>,
    OptionalAuth(user): OptionalAuth,
    Path(token): Path<String>,
) -> AppResult<Json<InvitePreviewDto>> {
    let token: InviteToken = token.parse()?;

    Ok(Json(
        GroupService::from_state(&s)
            .get_invite(&token, user.map(|u| u.user_id))
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/invites/{token}/accept",
    tag = "groups",
    params(("token" = String, Path)),
    responses((status = 200, body = InviteAcceptedDto)),
)]
pub async fn accept_invite(
    State(s): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Path(token): Path<String>,
) -> AppResult<Json<InviteAcceptedDto>> {
    let token: InviteToken = token.parse()?;

    Ok(Json(
        GroupService::from_state(&s)
            .accept_invite(AcceptInviteParams {
                user_id: user.user_id,
                token: &token,
                client: &client,
            })
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/groups",
    tag = "groups",
    request_body = CreateGroupDto,
    responses((status = 201, body = CreatedDto)),
)]
pub async fn create_group(
    State(s): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Json(dto): Json<CreateGroupDto>,
) -> AppResult<(StatusCode, Json<CreatedDto>)> {
    let group_name = DisplayName::parse(&dto.group_name, GROUP_NAME_MAX_CHARS, "groupName")?;

    let id = GroupService::from_state(&s)
        .create_group(CreateGroupParams {
            user_id: user.user_id,
            group_name: &group_name,
            avatar_id: dto.avatar_id,
            group_type: dto.group_type,
            dalton_enabled: dto.dalton_enabled,
            client: &client,
        })
        .await?;

    Ok((StatusCode::CREATED, Json(CreatedDto { id })))
}

/// The caller's groups and where the app opens; answers signed-out callers
/// too, which is how the client learns whether a session exists.
#[utoipa::path(
    get,
    path = "/groups/status",
    tag = "groups",
    responses((status = 200, body = GroupStatusDto)),
)]
pub async fn get_groups_status(
    State(s): State<AppState>,
    OptionalAuth(user): OptionalAuth,
) -> AppResult<Json<GroupStatusDto>> {
    Ok(Json(
        GroupService::from_state(&s)
            .get_status(user.map(|u| u.user_id))
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/",
    tag = "groups",
    responses((status = 200, body = GroupSummaryDto)),
)]
pub async fn get_group(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<GroupSummaryDto>> {
    Ok(Json(GroupService::from_state(&s).get_group(&tc).await?))
}

/// Remembers the group as where the app opens next time.
#[utoipa::path(
    post,
    path = "/visit",
    tag = "groups",
    responses((status = 204)),
)]
pub async fn record_visit(State(s): State<AppState>, tc: TenantContext) -> AppResult<StatusCode> {
    GroupService::from_state(&s)
        .record_visit(tc.user.user_id, tc.tenant_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/leave",
    tag = "groups",
    responses((status = 204)),
)]
pub async fn leave_group(State(s): State<AppState>, tc: TenantContext) -> AppResult<StatusCode> {
    GroupService::from_state(&s)
        .leave_group(tc.user.user_id, tc.tenant_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Every member may see who else is in the group; only the pseudonyms are
/// exposed, never emails.
#[utoipa::path(
    get,
    path = "/members",
    tag = "groups",
    responses((status = 200, body = Vec<GroupMemberDto>)),
)]
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

#[utoipa::path(
    get,
    path = "/admin/banned-users",
    tag = "groups",
    responses((status = 200, body = Vec<BannedMemberDto>)),
)]
pub async fn get_banned_users(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Vec<BannedMemberDto>>> {
    require_permission!(tc, Permission::ModerateMembers);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_banned_users(tc.tenant_id)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/admin/banned-users/{user_id}",
    tag = "groups",
    params(MemberPath),
    responses((status = 204)),
)]
pub async fn revert_ban(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::ModerateMembers);

    GroupAdminService::from_state(&s)
        .revert_ban(tc.tenant_id, tc.user.user_id, target, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    patch,
    path = "/admin/members/{user_id}/role",
    tag = "groups",
    params(MemberPath),
    request_body = ChangeMemberRoleDto,
    responses((status = 204)),
)]
pub async fn change_member_role(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
    Json(dto): Json<ChangeMemberRoleDto>,
) -> AppResult<StatusCode> {
    GroupAdminService::from_state(&s)
        .change_member_role(
            tc.tenant_id,
            Caller::from_tenant(&tc),
            target,
            dto.role,
            &client,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The previous owner stays in the group as an admin.
#[utoipa::path(
    post,
    path = "/admin/transfer-ownership",
    tag = "groups",
    request_body = TransferOwnershipDto,
    responses((status = 204)),
)]
pub async fn transfer_ownership(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Json(dto): Json<TransferOwnershipDto>,
) -> AppResult<StatusCode> {
    GroupAdminService::from_state(&s)
        .transfer_ownership(
            tc.tenant_id,
            Caller::from_tenant(&tc),
            dto.target_user_id,
            &client,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put,
    path = "/admin/members/{user_id}/mute",
    tag = "groups",
    params(MemberPath),
    responses((status = 204)),
)]
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

#[utoipa::path(
    delete,
    path = "/admin/members/{user_id}/mute",
    tag = "groups",
    params(MemberPath),
    responses((status = 204)),
)]
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

#[utoipa::path(
    delete,
    path = "/admin/members/{user_id}",
    tag = "groups",
    params(MemberPath, RemoveMemberQuery),
    responses((status = 204)),
)]
pub async fn remove_member(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(MemberPath { user_id: target }): Path<MemberPath>,
    Query(q): Query<RemoveMemberQuery>,
) -> AppResult<StatusCode> {
    GroupAdminService::from_state(&s)
        .remove_member(
            tc.tenant_id,
            Caller::from_tenant(&tc),
            target,
            q.ban,
            &client,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The group's profile (name, picture) and configuration (type, Dalton) need
/// separate permissions.
#[utoipa::path(
    patch,
    path = "/admin/settings",
    tag = "groups",
    request_body = UpdateGroupSettingsDto,
    responses((status = 204)),
)]
pub async fn update_group_settings(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<UpdateGroupSettingsDto>,
) -> AppResult<StatusCode> {
    let name = dto
        .name
        .as_deref()
        .map(|name| DisplayName::parse(name, GROUP_NAME_MAX_CHARS, "name"))
        .transpose()?;

    let edits_profile = name.is_some() || dto.avatar_id.is_some();
    let edits_configuration = dto.group_type.is_some() || dto.dalton_enabled.is_some();
    if !edits_profile && !edits_configuration {
        return Err(AppError::bad_request("Nothing to change."));
    }

    if edits_profile {
        require_permission!(tc, Permission::EditGroupProfile);
    }
    if edits_configuration {
        require_permission!(tc, Permission::EditGroupConfiguration);
    }

    GroupAdminService::from_state(&s)
        .update_settings(
            tc.tenant_id,
            tc.user.user_id,
            name.as_ref(),
            dto.avatar_id,
            dto.group_type,
            dto.dalton_enabled,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/admin/permissions",
    tag = "groups",
    responses((status = 200, body = GroupPermissions)),
)]
pub async fn get_permissions(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<GroupPermissions>> {
    require_owner_rights(&tc)?;

    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_permissions(tc.tenant_id)
            .await?,
    ))
}

#[utoipa::path(
    patch,
    path = "/admin/permissions",
    tag = "groups",
    request_body = UpdateGroupPermissionsDto,
    responses((status = 200, body = GroupPermissions)),
)]
pub async fn update_permissions(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<UpdateGroupPermissionsDto>,
) -> AppResult<Json<GroupPermissions>> {
    require_owner_rights(&tc)?;

    Ok(Json(
        GroupAdminService::from_state(&s)
            .update_permissions(tc.tenant_id, tc.user.user_id, &dto.permissions, &client)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/",
    tag = "groups",
    responses((status = 204)),
)]
pub async fn delete_group(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
) -> AppResult<StatusCode> {
    require_owner_rights(&tc)?;

    GroupAdminService::from_state(&s)
        .delete_group(tc.tenant_id, tc.user.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/admin/subjects",
    tag = "groups",
    responses((status = 200, body = Vec<SubjectDto>)),
)]
pub async fn get_subjects_admin(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Vec<SubjectDto>>> {
    require_permission!(tc, Permission::EditSubjectsCourses);

    Ok(Json(
        ScheduleService::from_state(&s)
            .get_subjects(tc.tenant_id)
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/admin/subjects",
    tag = "groups",
    request_body = CreateSubjectDto,
    responses((status = 201, body = SubjectDto)),
)]
pub async fn create_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<CreateSubjectDto>,
) -> AppResult<(StatusCode, Json<SubjectDto>)> {
    require_permission!(tc, Permission::EditSubjectsCourses);
    let name = DisplayName::parse(&dto.name, SUBJECT_NAME_MAX_CHARS, "name")?;

    let subject = GroupAdminService::from_state(&s)
        .create_subject(
            tc.tenant_id,
            tc.user.user_id,
            &name,
            dto.category,
            dto.is_dalton,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(subject)))
}

#[utoipa::path(
    patch,
    path = "/admin/subjects/{id}",
    tag = "groups",
    params(IdPath),
    request_body = UpdateSubjectDto,
    responses((status = 204)),
)]
pub async fn update_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<UpdateSubjectDto>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::EditSubjectsCourses);
    let name = dto
        .name
        .as_deref()
        .map(|n| DisplayName::parse(n, SUBJECT_NAME_MAX_CHARS, "name"))
        .transpose()?;

    GroupAdminService::from_state(&s)
        .update_subject(
            tc.tenant_id,
            tc.user.user_id,
            id,
            name.as_ref(),
            dto.category,
            dto.is_dalton,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Tasks of the subject keep its name as a hand-typed one.
#[utoipa::path(
    delete,
    path = "/admin/subjects/{id}",
    tag = "groups",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn delete_subject(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::EditSubjectsCourses);

    GroupAdminService::from_state(&s)
        .delete_subject(tc.tenant_id, tc.user.user_id, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/admin/subjects/{subject_id}/courses",
    tag = "groups",
    params(SubjectPath),
    request_body = CreateCourseDto,
    responses((status = 201, body = CourseDto)),
)]
pub async fn create_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(SubjectPath { subject_id }): Path<SubjectPath>,
    Json(dto): Json<CreateCourseDto>,
) -> AppResult<(StatusCode, Json<CourseDto>)> {
    require_permission!(tc, Permission::EditSubjectsCourses);
    let name = DisplayName::parse(&dto.name, COURSE_NAME_MAX_CHARS, "name")?;

    let course = GroupAdminService::from_state(&s)
        .create_course(
            tc.tenant_id,
            tc.user.user_id,
            subject_id,
            &name,
            dto.course_type,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(course)))
}

#[utoipa::path(
    patch,
    path = "/admin/courses/{id}",
    tag = "groups",
    params(IdPath),
    request_body = UpdateCourseDto,
    responses((status = 200, body = CourseDto)),
)]
pub async fn update_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<UpdateCourseDto>,
) -> AppResult<Json<CourseDto>> {
    require_permission!(tc, Permission::EditSubjectsCourses);
    let name = DisplayName::parse(&dto.name, COURSE_NAME_MAX_CHARS, "name")?;

    Ok(Json(
        GroupAdminService::from_state(&s)
            .update_course(tc.tenant_id, tc.user.user_id, id, &name, dto.course_type)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/admin/courses/{id}",
    tag = "groups",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn delete_course(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::EditSubjectsCourses);

    GroupAdminService::from_state(&s)
        .delete_course(tc.tenant_id, tc.user.user_id, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The whole timetable without personalization. Readable by every member,
/// like `/schedule`.
#[utoipa::path(
    get,
    path = "/admin/schedule",
    tag = "groups",
    responses((status = 200, body = ScheduleDto)),
)]
pub async fn get_schedule_admin(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<ScheduleDto>> {
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_schedule(tc.tenant_id, None)
            .await?,
    ))
}

/// Replaces the timetable and the layout of the school day at once.
#[utoipa::path(
    put,
    path = "/admin/schedule",
    tag = "groups",
    request_body = ReplaceScheduleDto,
    responses((status = 204)),
)]
pub async fn replace_schedule_admin(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<ReplaceScheduleDto>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::EditSchedule);

    GroupAdminService::from_state(&s)
        .replace_schedule(tc.tenant_id, tc.user.user_id, dto)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Readable by every member, like `/schedule/subs`.
#[utoipa::path(
    get,
    path = "/admin/schedule/subs",
    tag = "groups",
    params(ScheduleSubsQuery),
    responses((status = 200, body = Vec<SubstitutionDto>)),
)]
pub async fn get_schedule_subs_admin(
    State(s): State<AppState>,
    tc: TenantContext,
    Query(weeks): Query<ScheduleSubsQuery>,
) -> AppResult<Json<Vec<SubstitutionDto>>> {
    Ok(Json(
        ScheduleService::from_state(&s)
            .get_subs(tc.tenant_id, weeks)
            .await?,
    ))
}

#[utoipa::path(
    put,
    path = "/admin/schedule/subs",
    tag = "groups",
    request_body = ScheduleSubDto,
    responses((status = 200, body = SubstitutionDto)),
)]
pub async fn save_schedule_sub(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<ScheduleSubDto>,
) -> AppResult<Json<SubstitutionDto>> {
    require_permission!(tc, Permission::ManageScheduleChanges);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .save_schedule_sub(tc.tenant_id, tc.user.user_id, dto)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/admin/schedule/subs/{id}",
    tag = "groups",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn delete_schedule_sub(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::ManageScheduleChanges);

    GroupAdminService::from_state(&s)
        .delete_schedule_sub(tc.tenant_id, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/admin/invites",
    tag = "groups",
    responses((status = 200, body = Vec<GroupInviteDto>)),
)]
pub async fn get_invites(
    State(s): State<AppState>,
    tc: TenantContext,
) -> AppResult<Json<Vec<GroupInviteDto>>> {
    require_permission!(tc, Permission::ModerateMembers);

    Ok(Json(
        GroupAdminService::from_state(&s)
            .get_invites(tc.tenant_id)
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/admin/invites/{id}",
    tag = "groups",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn revoke_invite(
    State(s): State<AppState>,
    tc: TenantContext,
    client: ClientInfo,
    Path(IdPath { id: invite_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    require_permission!(tc, Permission::ModerateMembers);

    GroupAdminService::from_state(&s)
        .revoke_invite(tc.tenant_id, tc.user.user_id, invite_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
