use super::handlers::*;
use crate::{
    access_control, common::extractors::require_superadmin, state::AppState, system_announcements,
};
use axum::middleware;
use utoipa_axum::{router::OpenApiRouter, routes};

/// Every route here sits behind the `require_superadmin` layer.
pub fn router(state: AppState) -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_stats))
        .routes(routes!(get_daily_activity))
        .routes(routes!(get_weekly_rhythm))
        .routes(routes!(get_account_security))
        .routes(routes!(get_server_metrics))
        .routes(routes!(get_email_activity))
        .routes(routes!(get_email_quota))
        .routes(routes!(get_cleanup_jobs))
        .routes(routes!(get_events))
        .routes(routes!(list_admin_groups))
        .routes(routes!(get_admin_group, delete_admin_group))
        .routes(routes!(ban_group, unban_group))
        .routes(routes!(list_admin_users))
        .routes(routes!(get_admin_user, delete_admin_user))
        .routes(routes!(get_user_memberships))
        .routes(routes!(change_membership_role))
        .routes(routes!(ban_user, unban_user))
        .routes(routes!(reset_user_mfa))
        .routes(routes!(get_reports))
        .routes(routes!(delete_report))
        .merge(system_announcements::routes::admin_router())
        .merge(access_control::routes::admin_router())
        .route_layer(middleware::from_fn_with_state(state, require_superadmin))
}
