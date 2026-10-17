use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_system_announcements))
        .routes(routes!(mark_system_announcements_read))
}

/// Merged into the super admin router, behind its `require_superadmin` layer.
pub fn admin_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(
            list_admin_system_announcements,
            create_system_announcement
        ))
        .routes(routes!(
            update_system_announcement,
            delete_system_announcement
        ))
}
