use super::{
    dto::{PasskeyReauthDto, PasswordReauthDto, ReauthStatus},
    service::ReauthService,
};
use crate::{
    common::{
        client::ClientInfo,
        extractors::{AuthUser, ValidatedJson},
    },
    config::REAUTH_PENDING_COOKIE,
    error::AppResult,
    mfa::second_factor::SecondFactorProof,
    oauth::dto::GoogleAuthUrlDto,
    passkeys::dto::PasskeyChallengeDto,
    state::AppState,
};
use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;

/// How the user can confirm who they are, and until when a confirmation
/// still counts.
#[utoipa::path(
    get,
    path = "/auth/reauth",
    tag = "reauth",
    responses((status = 200, body = ReauthStatus)),
)]
pub async fn get_reauth_status(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<ReauthStatus>> {
    Ok(Json(ReauthService::from_state(&state).status(&user).await?))
}

#[utoipa::path(
    post,
    path = "/auth/reauth/password",
    tag = "reauth",
    request_body = PasswordReauthDto,
    responses((status = 204)),
)]
pub async fn confirm_with_password(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<PasswordReauthDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = ReauthService::from_state(&state)
        .with_password(&user, dto.password, dto.second_factor.as_ref(), &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(
    post,
    path = "/auth/reauth/passkey/start",
    tag = "reauth",
    responses((status = 200, body = PasskeyChallengeDto)),
)]
pub async fn start_passkey(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<PasskeyChallengeDto>> {
    let (challenge_id, options) = ReauthService::from_state(&state)
        .start_passkey(&user)
        .await?;

    Ok(Json(PasskeyChallengeDto {
        challenge_id,
        options,
    }))
}

#[utoipa::path(
    post,
    path = "/auth/reauth/passkey/finish",
    tag = "reauth",
    request_body = PasskeyReauthDto,
    responses((status = 204)),
)]
pub async fn confirm_with_passkey(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Json(dto): Json<PasskeyReauthDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = ReauthService::from_state(&state)
        .finish_passkey(&user, dto.challenge_id, &dto.credential, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

/// A POST rather than a navigation, like linking Google: it needs the CSRF
/// check and lets the client refresh an expired access token first.
#[utoipa::path(
    post,
    path = "/auth/reauth/google/start",
    tag = "reauth",
    responses((status = 200, body = GoogleAuthUrlDto)),
)]
pub async fn start_google(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<(CookieJar, Json<GoogleAuthUrlDto>)> {
    let (url, jar) = ReauthService::from_state(&state)
        .start_google(&user)
        .await?;

    Ok((jar, Json(GoogleAuthUrlDto { url })))
}

#[utoipa::path(
    post,
    path = "/auth/reauth/google/second-factor",
    tag = "reauth",
    request_body = SecondFactorProof,
    responses((status = 204)),
)]
pub async fn confirm_google_second_factor(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    jar: CookieJar,
    ValidatedJson(proof): ValidatedJson<SecondFactorProof>,
) -> AppResult<(CookieJar, StatusCode)> {
    let pending = jar.get(REAUTH_PENDING_COOKIE).map(|c| c.value());
    let jar = ReauthService::from_state(&state)
        .finish_google(&user, pending, &proof, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}
