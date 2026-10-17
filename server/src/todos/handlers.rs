use super::{dto::*, service::TodoService};
use crate::{common::extractors::AuthUser, error::AppResult, state::AppState};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use uuid::Uuid;

/// The user's private tasks in their order.
#[utoipa::path(
    get,
    path = "/todos",
    tag = "todos",
    responses((status = 200, body = Vec<TodoDto>)),
)]
pub async fn get_todos(State(s): State<AppState>, user: AuthUser) -> AppResult<Json<Vec<TodoDto>>> {
    Ok(Json(
        TodoService::from_state(&s).get_todos(user.user_id).await?,
    ))
}

/// Adds a private task at the top of the list.
#[utoipa::path(
    post,
    path = "/todos",
    tag = "todos",
    request_body = TodoContentDto,
    responses((status = 201, body = TodoDto)),
)]
pub async fn create_todo(
    State(s): State<AppState>,
    user: AuthUser,
    Json(dto): Json<TodoContentDto>,
) -> AppResult<(StatusCode, Json<TodoDto>)> {
    let content = dto.parse()?;

    let todo = TodoService::from_state(&s)
        .create_todo(user.user_id, &content)
        .await?;

    Ok((StatusCode::CREATED, Json(todo)))
}

#[utoipa::path(
    put,
    path = "/todos/{id}",
    tag = "todos",
    params(("id" = Uuid, Path)),
    request_body = TodoContentDto,
    responses((status = 200, body = TodoDto)),
)]
pub async fn update_todo(
    State(s): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(dto): Json<TodoContentDto>,
) -> AppResult<Json<TodoDto>> {
    let content = dto.parse()?;

    Ok(Json(
        TodoService::from_state(&s)
            .update_todo(user.user_id, id, &content)
            .await?,
    ))
}

#[utoipa::path(
    patch,
    path = "/todos/{id}/toggle",
    tag = "todos",
    params(("id" = Uuid, Path)),
    responses((status = 200, body = TodoToggledDto)),
)]
pub async fn toggle_todo(
    State(s): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<TodoToggledDto>> {
    Ok(Json(
        TodoService::from_state(&s)
            .toggle_todo(user.user_id, id)
            .await?,
    ))
}

#[utoipa::path(
    patch,
    path = "/todos/{id}/reorder",
    tag = "todos",
    params(("id" = Uuid, Path)),
    request_body = ReorderTodoDto,
    responses((status = 200, body = TodoMovedDto)),
)]
pub async fn reorder_todo(
    State(s): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(dto): Json<ReorderTodoDto>,
) -> AppResult<Json<TodoMovedDto>> {
    Ok(Json(
        TodoService::from_state(&s)
            .reorder_todo(
                user.user_id,
                id,
                dto.prev_position.as_deref(),
                dto.next_position.as_deref(),
            )
            .await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/todos/{id}",
    tag = "todos",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn delete_todo(
    State(s): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    TodoService::from_state(&s)
        .delete_todo(user.user_id, id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
