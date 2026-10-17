use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

/// Mounted under `/groups/{group_id}` behind the tenant middleware.
pub fn group_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_schedule))
        .routes(routes!(get_subs))
        .routes(routes!(get_subjects))
}
