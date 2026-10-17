use super::{dto::*, service::UserService};
use crate::{
    common::{
        extractors::{AuthUser, TenantContext},
        path_params::IdPath,
    },
    error::AppResult,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
};

#[utoipa::path(
    patch,
    path = "/user/personalization",
    tag = "user",
    request_body = UpdatePersonalizationDto,
    responses((status = 204)),
)]
pub async fn update_personalization(
    State(s): State<AppState>,
    user: AuthUser,
    Json(dto): Json<UpdatePersonalizationDto>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .update_personalization(user.user_id, dto.personalized)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Saves the named settings and keeps the others.
#[utoipa::path(
    patch,
    path = "/user/preferences",
    tag = "user",
    request_body = UpdatePreferencesDto,
    responses((status = 200, body = PreferencesDto)),
)]
pub async fn update_preferences(
    State(s): State<AppState>,
    user: AuthUser,
    Json(changes): Json<UpdatePreferencesDto>,
) -> AppResult<Json<PreferencesDto>> {
    Ok(Json(
        UserService::from_state(&s)
            .update_preferences(user.user_id, &changes)
            .await?,
    ))
}

#[utoipa::path(
    put,
    path = "/user/dismissed-notices/{notice}",
    tag = "user",
    params(NoticePath),
    responses((status = 204)),
)]
pub async fn dismiss_notice(
    State(s): State<AppState>,
    user: AuthUser,
    Path(NoticePath { notice }): Path<NoticePath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .dismiss_notice(user.user_id, notice)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Replaces the member's course selection in this group.
#[utoipa::path(
    patch,
    path = "/me/courses",
    tag = "user",
    request_body = UpdateSetupDto,
    responses((status = 204)),
)]
pub async fn update_setup(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<UpdateSetupDto>,
) -> AppResult<StatusCode> {
    let courses = dto
        .courses
        .into_iter()
        .map(|c| (c.subject_id, c.course_id))
        .collect();

    UserService::from_state(&s)
        .update_setup(tc.user.user_id, tc.tenant_id, courses)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Clears the member's courses in this group and asks for them again.
#[utoipa::path(
    delete,
    path = "/me/courses",
    tag = "user",
    responses((status = 204)),
)]
pub async fn reset_setup(State(s): State<AppState>, tc: TenantContext) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .reset_setup(tc.user.user_id, tc.tenant_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The tasks the user checked off, in every group.
#[utoipa::path(
    get,
    path = "/user/checks",
    tag = "user",
    responses((status = 200, body = ItemIdsDto)),
)]
pub async fn get_checks(State(s): State<AppState>, user: AuthUser) -> AppResult<Json<ItemIdsDto>> {
    Ok(Json(
        UserService::from_state(&s).get_checks(user.user_id).await?,
    ))
}

/// The tasks the user pinned, in every group.
#[utoipa::path(
    get,
    path = "/user/pins",
    tag = "user",
    responses((status = 200, body = ItemIdsDto)),
)]
pub async fn get_pins(State(s): State<AppState>, user: AuthUser) -> AppResult<Json<ItemIdsDto>> {
    Ok(Json(
        UserService::from_state(&s).get_pins(user.user_id).await?,
    ))
}

/// The tasks the user moved into or kept out of the archive, in every group.
#[utoipa::path(
    get,
    path = "/user/visibility",
    tag = "user",
    responses((status = 200, body = VisibilityDto)),
)]
pub async fn get_visibility(
    State(s): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<VisibilityDto>> {
    Ok(Json(
        UserService::from_state(&s)
            .get_visibility(user.user_id)
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/items/{id}/visibility",
    tag = "user",
    params(IdPath),
    request_body = VisibilityStatusDto,
    responses((status = 204)),
)]
pub async fn set_visibility(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
    Json(dto): Json<VisibilityStatusDto>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .set_visibility(tc.tenant_id, item_id, tc.user.user_id, dto.status)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/items/{id}/visibility",
    tag = "user",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn remove_visibility(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .remove_visibility(tc.tenant_id, item_id, tc.user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/user/activity/pageload",
    tag = "user",
    responses((status = 204)),
)]
pub async fn log_page_load(
    State(s): State<AppState>,
    user: AuthUser,
    headers: HeaderMap,
) -> AppResult<StatusCode> {
    let ua = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    UserService::from_state(&s)
        .log_page_load(user.user_id, ua)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/items/{id}/check",
    tag = "user",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn check_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .check_item(tc.tenant_id, item_id, tc.user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/items/{id}/check",
    tag = "user",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn uncheck_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .uncheck_item(tc.tenant_id, item_id, tc.user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/items/{id}/pin",
    tag = "user",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn pin_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .pin_item(tc.tenant_id, item_id, tc.user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/items/{id}/pin",
    tag = "user",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn unpin_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id: item_id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    UserService::from_state(&s)
        .unpin_item(tc.tenant_id, item_id, tc.user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
