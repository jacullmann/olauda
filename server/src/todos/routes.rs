use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_todos, create_todo))
        .routes(routes!(update_todo, delete_todo))
        .routes(routes!(toggle_todo))
        .routes(routes!(reorder_todo))
}
