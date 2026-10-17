use super::handlers::*;
use crate::state::AppState;
use axum::extract::DefaultBodyLimit;
use utoipa_axum::{
    router::{OpenApiRouter, UtoipaMethodRouterExt},
    routes,
};

/// A whole timetable is replaced at once. Its 250 lessons at most, each with
/// three ids and a room name of up to 100 bytes, stay well below this.
const SCHEDULE_BODY_LIMIT_BYTES: usize = 256 * 1024;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(create_group))
        .routes(routes!(get_groups_status))
        .routes(routes!(get_invite))
        .routes(routes!(accept_invite))
}

/// Mounted under `/groups/{group_id}` behind the tenant middleware.
pub fn group_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_group, delete_group))
        .routes(routes!(record_visit))
        .routes(routes!(leave_group))
        .routes(routes!(get_members))
        .routes(routes!(create_invite))
        .routes(routes!(get_banned_users))
        .routes(routes!(revert_ban))
        .routes(routes!(get_invites))
        .routes(routes!(revoke_invite))
        .routes(routes!(change_member_role))
        .routes(routes!(mute_member, unmute_member))
        .routes(routes!(remove_member))
        .routes(routes!(transfer_ownership))
        .routes(routes!(update_group_settings))
        .routes(routes!(get_permissions, update_permissions))
        .routes(routes!(get_subjects_admin, create_subject))
        .routes(routes!(update_subject, delete_subject))
        .routes(routes!(create_course))
        .routes(routes!(update_course, delete_course))
        .routes(routes!(get_schedule_admin))
        .routes(
            routes!(replace_schedule_admin).layer(DefaultBodyLimit::max(SCHEDULE_BODY_LIMIT_BYTES)),
        )
        .routes(routes!(get_schedule_subs_admin, save_schedule_sub))
        .routes(routes!(delete_schedule_sub))
}
