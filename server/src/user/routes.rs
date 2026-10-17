use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(update_personalization))
        .routes(routes!(update_preferences))
        .routes(routes!(dismiss_notice))
        .routes(routes!(get_checks))
        .routes(routes!(get_pins))
        .routes(routes!(get_visibility))
        .routes(routes!(log_page_load))
}

/// Mounted under `/groups/{group_id}` behind the tenant middleware: the
/// caller's own state for this group and its items.
pub fn group_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(update_setup, reset_setup))
        .routes(routes!(set_visibility, remove_visibility))
        .routes(routes!(check_item, uncheck_item))
        .routes(routes!(pin_item, unpin_item))
}
