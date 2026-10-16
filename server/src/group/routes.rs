use super::handlers::*;
use crate::state::AppState;
use axum::{
    Router,
    extract::DefaultBodyLimit,
    handler::Handler,
    routing::{delete, get, patch, post, put},
};

/// A whole timetable is replaced at once. Its 250 lessons at most, each with
/// three ids and a room name of up to 100 bytes, stay well below this.
const SCHEDULE_BODY_LIMIT_BYTES: usize = 256 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/groups", post(create_group))
        .route("/groups/status", get(get_status))
        .route("/invites/{token}", get(get_invite))
        .route("/invites/{token}/accept", post(accept_invite))
}

/// Mounted under `/groups/{group_id}` behind the tenant middleware.
pub fn group_router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_group).delete(delete_group))
        .route("/visit", post(record_visit))
        .route("/leave", delete(leave_group))
        .route("/members", get(get_members))
        .route("/invites", post(create_invite))
        .route("/admin/banned-users", get(get_banned_users))
        .route("/admin/banned-users/{user_id}", delete(revert_ban))
        .route("/admin/invites", get(get_invites))
        .route("/admin/invites/{id}", delete(revoke_invite))
        .route("/admin/members/{user_id}/role", patch(change_member_role))
        .route(
            "/admin/members/{user_id}/mute",
            put(mute_member).delete(unmute_member),
        )
        .route("/admin/members/{user_id}", delete(remove_member))
        .route("/admin/transfer-ownership", post(transfer_ownership))
        .route("/admin/settings", patch(rename_group))
        .route(
            "/admin/permissions",
            get(get_permissions).patch(update_permissions),
        )
        .route(
            "/admin/subjects",
            get(get_subjects_admin).post(create_subject),
        )
        .route(
            "/admin/subjects/{id}",
            patch(update_subject).delete(delete_subject),
        )
        .route("/admin/subjects/{subject_id}/courses", post(create_course))
        .route(
            "/admin/courses/{id}",
            patch(update_course).delete(delete_course),
        )
        .route(
            "/admin/schedule",
            get(get_schedule_admin).put(
                replace_schedule_admin.layer(DefaultBodyLimit::max(SCHEDULE_BODY_LIMIT_BYTES)),
            ),
        )
        .route(
            "/admin/schedule/subs",
            get(get_schedule_subs_admin).put(save_schedule_sub),
        )
        .route("/admin/schedule/subs/{id}", delete(delete_schedule_sub))
}
