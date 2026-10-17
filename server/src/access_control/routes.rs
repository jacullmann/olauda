use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_access_status))
}

/// Merged into the super admin router, behind its `require_superadmin` layer.
pub fn admin_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_access_controls, update_access_controls))
}
