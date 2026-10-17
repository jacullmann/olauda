use crate::{common::csrf::generate_csrf_token, state::AppState};
use axum::{extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct HealthDto {
    pub status: &'static str,
    pub timestamp: DateTime<Utc>,
}

/// Liveness check for the deployment.
#[utoipa::path(
    get,
    path = "/system/status",
    tag = "system",
    responses((status = 200, body = HealthDto)),
)]
pub async fn health() -> axum::Json<HealthDto> {
    axum::Json(HealthDto {
        status: "ok",
        timestamp: Utc::now(),
    })
}

/// Sets the cookie whose value every changing request repeats in the
/// `x-csrf-token` header.
#[utoipa::path(
    get,
    path = "/system/csrf/init",
    tag = "system",
    responses((status = 204)),
)]
pub async fn csrf_init(State(state): State<AppState>, jar: CookieJar) -> (CookieJar, StatusCode) {
    let token = generate_csrf_token();
    let cookie = crate::common::csrf::csrf_cookie(&token, &state.config.base_cookie_options());

    (jar.add(cookie), StatusCode::NO_CONTENT)
}
