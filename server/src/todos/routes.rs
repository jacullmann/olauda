use super::handlers::*;
use crate::state::AppState;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(get_todos, create_todo))
        .routes(routes!(update_todo, delete_todo))
        .routes(routes!(set_todo_completed))
        .routes(routes!(move_todo))
}
