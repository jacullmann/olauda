use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{
    router::{OpenApiRouter, UtoipaMethodRouterExt},
    routes,
};

/// Mounted under `/groups/{group_id}` behind the tenant middleware.
pub fn group_router() -> OpenApiRouter<AppState> {
    // 50 tasks per minute per IP: a whole class behind one school NAT never
    // gets near it, while a spam script is throttled to under one per second.
    let create_limit = rate_limit::per_client(50, Duration::from_millis(1200));

    OpenApiRouter::new()
        .routes(routes!(get_items))
        .routes(routes!(create_item).layer(create_limit))
        .routes(routes!(report_item))
        .routes(routes!(get_item_by_id, update_item, delete_item))
        .routes(routes!(update_item_note))
        .routes(routes!(add_attachment))
        .routes(routes!(remove_attachment))
}
