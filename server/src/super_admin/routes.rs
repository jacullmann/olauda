use super::handlers::*;
use crate::{
    access_control, common::extractors::require_superadmin, state::AppState, system_announcements,
};
use axum::{
    Router, middleware,
    routing::{delete, get, patch, post},
};

/// Every route here sits behind the `require_superadmin` layer.
pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/admin/stats", get(get_stats))
        .route("/admin/stats/daily", get(get_daily_activity))
        .route("/admin/stats/weekly-rhythm", get(get_weekly_rhythm))
        .route("/admin/stats/account-security", get(get_account_security))
        .route("/admin/server-metrics", get(get_server_metrics))
        .route("/admin/emails/activity", get(get_email_activity))
        .route("/admin/emails/quota", get(get_email_quota))
        .route("/admin/cleanup-jobs", get(get_cleanup_jobs))
        .route("/admin/events", get(get_events))
        .route("/admin/groups", get(list_groups))
        .route("/admin/groups/{id}", get(get_group).delete(delete_group))
        .route(
            "/admin/groups/{id}/ban",
            post(ban_group).delete(unban_group),
        )
        .route("/admin/users", get(list_users))
        .route("/admin/users/{id}", get(get_user).delete(delete_user))
        .route("/admin/users/{id}/groups", get(get_user_memberships))
        .route(
            "/admin/users/{id}/groups/{group_id}/role",
            patch(change_membership_role),
        )
        .route("/admin/users/{id}/ban", post(ban_user).delete(unban_user))
        .route("/admin/users/{id}/mfa", delete(reset_user_mfa))
        .route("/admin/reports", get(get_reports))
        .route("/admin/reports/{id}", delete(delete_report))
        .merge(system_announcements::routes::admin_router())
        .merge(access_control::routes::admin_router())
        .route_layer(middleware::from_fn_with_state(state, require_superadmin))
}
