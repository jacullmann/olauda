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
    reports::service::ReportsService,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct MembershipPath {
    pub id: Uuid,
    pub group_id: Uuid,
}

pub async fn get_stats(State(s): State<AppState>, _: SuperAdmin) -> AppResult<Json<StatsDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_stats().await?))
}

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

pub async fn get_server_metrics(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<ServerMetricsQuery>,
) -> AppResult<Json<ServerMetricsDto>> {
    Ok(Json(read_server_metrics(&s.hetzner, q.range).await?))
}

pub async fn get_email_activity(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<EmailActivityDto>> {
    Ok(Json(read_email_activity(&s.email).await?))
}

pub async fn get_email_quota(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<EmailQuotaDto>> {
    Ok(Json(read_email_quota(&s.email).await?))
}

pub async fn get_cleanup_jobs(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<Vec<CleanupJobDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).get_cleanup_jobs().await?,
    ))
}

pub async fn list_groups(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<GroupsQuery>,
) -> AppResult<Json<Window<AdminGroupDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).list_groups(&q).await?,
    ))
}

pub async fn get_group(
    State(s): State<AppState>,
    _: SuperAdmin,
    Path(id): Path<Uuid>,
) -> AppResult<Json<AdminGroupDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_group(id).await?))
}

pub async fn ban_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .ban_group(id, admin.user_id, &client)
            .await?,
    ))
}

pub async fn unban_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .unban_group(id, admin.user_id, &client)
            .await?,
    ))
}

pub async fn delete_group(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let body = SuperAdminService::from_state(&s)
        .delete_group(id, admin.user_id, &client)
        .await?;

    Ok(Json(body))
}

pub async fn list_users(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<UsersQuery>,
) -> AppResult<Json<Window<AdminUserDto>>> {
    Ok(Json(
        SuperAdminService::from_state(&s).list_users(&q).await?,
    ))
}

pub async fn get_user(
    State(s): State<AppState>,
    _: SuperAdmin,
    Path(id): Path<Uuid>,
) -> AppResult<Json<AdminUserDto>> {
    Ok(Json(SuperAdminService::from_state(&s).get_user(id).await?))
}

pub async fn get_events(
    State(s): State<AppState>,
    _: SuperAdmin,
    Query(q): Query<EventLogQuery>,
) -> AppResult<Json<EventLogPage>> {
    Ok(Json(EventLogService::from_state(&s).page(&q).await?))
}

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
pub async fn change_membership_role(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(MembershipPath { id, group_id }): Path<MembershipPath>,
    Json(dto): Json<ChangeMembershipRoleDto>,
) -> AppResult<Json<Value>> {
    let groups = GroupAdminService::from_state(&s);
    let caller = superadmin_caller(admin.user_id);

    let role = match dto.role {
        MemberRole::Owner => {
            return Ok(Json(
                groups
                    .transfer_ownership(group_id, caller, id, &client)
                    .await?,
            ));
        }
        MemberRole::Admin => Role::Admin,
        MemberRole::Moderator => Role::Moderator,
        MemberRole::User => Role::User,
    };
    let body = groups
        .change_member_role(group_id, caller, id, role, &client)
        .await?;

    Ok(Json(body))
}

pub async fn ban_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let body = SuperAdminService::from_state(&s)
        .ban_user(target, admin.user_id, &client)
        .await?;

    Ok(Json(body))
}

pub async fn unban_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .unban_user(target, admin.user_id, &client)
            .await?,
    ))
}

pub async fn reset_user_mfa(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        SuperAdminService::from_state(&s)
            .reset_user_mfa(target, admin.user_id, &client)
            .await?,
    ))
}

pub async fn delete_user(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(target): Path<Uuid>,
) -> AppResult<Json<Value>> {
    let body = SuperAdminService::from_state(&s)
        .delete_user(target, admin.user_id, &client)
        .await?;

    Ok(Json(body))
}

pub async fn get_reports(State(s): State<AppState>, _: SuperAdmin) -> AppResult<Json<Value>> {
    Ok(Json(ReportsService::from_state(&s).list().await?))
}

pub async fn delete_report(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        ReportsService::from_state(&s)
            .delete(id, admin.user_id, &client)
            .await?,
    ))
}
