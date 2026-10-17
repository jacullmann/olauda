use super::{
    dto::{AccessStatusDto, UpdateAccessControlsDto},
    service::{self, AccessControlService, AccessControls},
};
use crate::{
    common::{client::ClientInfo, extractors::SuperAdmin},
    error::AppResult,
    state::AppState,
};
use axum::{Json, extract::State};

/// Whether sign-ups are open and the platform is running, for the sign-in
/// and sign-up pages.
#[utoipa::path(
    get,
    path = "/system/access",
    tag = "system",
    responses((status = 200, body = AccessStatusDto)),
)]
pub async fn get_access_status(State(s): State<AppState>) -> AppResult<Json<AccessStatusDto>> {
    Ok(Json(service::load(&s.db).await?.into()))
}

#[utoipa::path(
    get,
    path = "/admin/access-controls",
    tag = "admin",
    responses((status = 200, body = AccessControls)),
)]
pub async fn get_access_controls(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<AccessControls>> {
    Ok(Json(service::load(&s.db).await?))
}

#[utoipa::path(
    patch,
    path = "/admin/access-controls",
    tag = "admin",
    request_body = UpdateAccessControlsDto,
    responses((status = 200, body = AccessControls)),
)]
pub async fn update_access_controls(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Json(changes): Json<UpdateAccessControlsDto>,
) -> AppResult<Json<AccessControls>> {
    Ok(Json(
        AccessControlService::from_state(&s)
            .update(&changes, admin.user_id, &client)
            .await?,
    ))
}
