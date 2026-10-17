use super::{
    dto::*,
    event_log::{
        dto::{EventLogPage, EventLogQuery},
        service::EventLogService,
    },
    service::{
        SuperAdminService, read_email_activity, read_email_quota, read_server_metrics,
        superadmin_caller,
    },
};
use crate::{
    common::{
        client::ClientInfo,
        extractors::SuperAdmin,
        pagination::Window,
        role::{MemberRole, Role},
    },
    error::AppResult,
    group::admin::service::GroupAdminService,
    reports::{dto::ReportDto, service::ReportsService},
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use utoipa::IntoParams;
use uuid::Uuid;

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Path)]
pub struct MembershipPath {
    /// The member.
    pub id: Uuid,
    pub group_id: Uuid,
}

#[utoipa::path(
    get,
    path = "/admin/stats",
    tag = "admin",
    responses((status = 200, body = StatsDto)),
)]
pub async fn get_stats(State(s): State<AppState>, _: SuperAdmin) -> AppResult<Json<StatsDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_stats().await?))
}

#[utoipa::path(
    get,
    path = "/admin/stats/daily",
    tag = "admin",
    responses((status = 200, body = Vec<DailyActivityDto>)),
)]
pub async fn get_daily_activity(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<Vec<DailyActivityDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .get_daily_activity()
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/stats/account-security",
    tag = "admin",
    responses((status = 200, body = AccountSecurityDto)),
)]
pub async fn get_account_security(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<AccountSecurityDto>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .get_account_security()
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/stats/weekly-rhythm",
    tag = "admin",
    responses((status = 200, body = WeeklyRhythmDto)),
)]
pub async fn get_weekly_rhythm(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<WeeklyRhythmDto>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .get_weekly_rhythm()
            .await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/server-metrics",
    tag = "admin",
    params(ServerMetricsQuery),
    responses((status = 200, body = ServerMetricsDto)),
)]
pub async fn get_server_metrics(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<ServerMetricsQuery>,
) -> AppResult<Json<ServerMetricsDto>> {
    Ok(Json(read_server_metrics(&s.hetzner, q.range).await?))
}

#[utoipa::path(
    get,
    path = "/admin/emails/activity",
    tag = "admin",
    responses((status = 200, body = EmailActivityDto)),
)]
pub async fn get_email_activity(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<EmailActivityDto>> {
    Ok(Json(read_email_activity(&s.email).await?))
}

#[utoipa::path(
    get,
    path = "/admin/emails/quota",
    tag = "admin",
    responses((status = 200, body = EmailQuotaDto)),
)]
pub async fn get_email_quota(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<EmailQuotaDto>> {
    Ok(Json(read_email_quota(&s.email).await?))
}

#[utoipa::path(
    get,
    path = "/admin/cleanup-jobs",
    tag = "admin",
    responses((status = 200, body = Vec<CleanupJobDto>)),
)]
pub async fn get_cleanup_jobs(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<Vec<CleanupJobDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).get_cleanup_jobs().await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/groups",
    tag = "admin",
    params(GroupsQuery),
    responses((status = 200, body = Window<AdminGroupDto>)),
)]
pub async fn list_admin_groups(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<GroupsQuery>,
) -> AppResult<Json<Window<AdminGroupDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).list_groups(&q).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/groups/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = AdminGroupDto)),
)]
pub async fn get_admin_group(
    State(s): State<AppState>,
    _: SuperAdmin,
    Path(id): Path<Uuid>,
) -> AppResult<Json<AdminGroupDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_group(id).await?))
}

/// Only superadmins can open a banned group; its invites admit nobody.
#[utoipa::path(
    post,
    path = "/admin/groups/{id}/ban",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn ban_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .ban_group(id, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/groups/{id}/ban",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn unban_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .unban_group(id, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/groups/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn delete_admin_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .delete_group(id, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/admin/users",
    tag = "admin",
    params(UsersQuery),
    responses((status = 200, body = Window<AdminUserDto>)),
)]
pub async fn list_admin_users(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<UsersQuery>,
) -> AppResult<Json<Window<AdminUserDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).list_users(&q).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/admin/users/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = AdminUserDto)),
)]
pub async fn get_admin_user(
    State(s): State<AppState>,
    _: SuperAdmin,
    Path(id): Path<Uuid>,
) -> AppResult<Json<AdminUserDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_user(id).await?))
}

/// The security and activity logs, newest or oldest first, a page at a time.
#[utoipa::path(
    get,
    path = "/admin/events",
    tag = "admin",
    params(EventLogQuery),
    responses((status = 200, body = EventLogPage)),
)]
pub async fn get_events(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<EventLogQuery>,
) -> AppResult<Json<EventLogPage>> {
    Ok(Json(EventLogService::from_state(&s).page(&q).await?))
}

#[utoipa::path(
    get,
    path = "/admin/users/{id}/groups",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = Vec<UserMembershipDto>)),
)]
pub async fn get_user_memberships(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<UserMembershipDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .get_user_memberships(id, admin.user_id)
            .await?,
    ))
}

/// Picking "owner" hands the group over; the previous owner stays as admin.
#[utoipa::path(
    patch,
    path = "/admin/users/{id}/groups/{group_id}/role",
    tag = "admin",
    params(MembershipPath),
    request_body = ChangeMembershipRoleDto,
    responses((status = 204)),
)]
pub async fn change_membership_role(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(MembershipPath { id, group_id }): Path<MembershipPath>,
    Json(dto): Json<ChangeMembershipRoleDto>,
) -> AppResult<StatusCode> {
    let groups = GroupAdminService::from_state(&s);
    let caller = superadmin_caller(admin.user_id);

    let role = match dto.role {
        MemberRole::Owner => {
            groups
                .transfer_ownership(group_id, caller, id, &client)
                .await?;
            return Ok(StatusCode::NO_CONTENT);
        }
        MemberRole::Admin => Role::Admin,
        MemberRole::Moderator => Role::Moderator,
        MemberRole::User => Role::User,
    };
    groups
        .change_member_role(group_id, caller, id, role, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Ends every session of the user at once.
#[utoipa::path(
    post,
    path = "/admin/users/{id}/ban",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn ban_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .ban_user(target, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/users/{id}/ban",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn unban_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .unban_user(target, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/users/{id}/mfa",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn reset_user_mfa(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .reset_user_mfa(target, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/users/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn delete_admin_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<StatusCode> {
    SuperAdminService::from_state(&s)
        .delete_user(target, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Reports, newest first, each with a snapshot of the reported task.
#[utoipa::path(
    get,
    path = "/admin/reports",
    tag = "admin",
    responses((status = 200, body = Vec<ReportDto>)),
)]
pub async fn get_reports(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<Vec<ReportDto>>> {
    Ok(Json(ReportsService::from_state(&s).list().await?))
}

#[utoipa::path(
    delete,
    path = "/admin/reports/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn delete_report(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    ReportsService::from_state(&s)
        .delete(id, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
