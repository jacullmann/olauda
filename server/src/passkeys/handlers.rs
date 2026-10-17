use super::{
    dto::*,
    service::{PasskeyName, PasskeyService},
};
use crate::{
    common::{
        client::ClientInfo,
        extractors::{AuthUser, RecentAuth, ValidatedJson},
        path_params::IdPath,
    },
    error::AppResult,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use axum_extra::extract::CookieJar;

#[utoipa::path(
    get,
    path = "/passkeys",
    tag = "passkeys",
    responses((status = 200, body = PasskeyList)),
)]
pub async fn list_passkeys(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<PasskeyList>> {
    Ok(Json(
        PasskeyService::from_state(&state)
            .list(user.user_id)
            .await?,
    ))
}

/// A new passkey is a lasting way in, so adding one needs a recent sign-in:
/// otherwise a stolen session could outlive its own revocation. Finishing only
/// redeems the registration started here.
#[utoipa::path(
    post,
    path = "/passkeys/registration/start",
    tag = "passkeys",
    responses((status = 200, body = PasskeyRegistrationDto)),
)]
pub async fn start_registration(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
) -> AppResult<Json<PasskeyRegistrationDto>> {
    let options = PasskeyService::from_state(&state)
        .start_registration(user.user_id)
        .await?;

    Ok(Json(PasskeyRegistrationDto { options }))
}

#[utoipa::path(
    post,
    path = "/passkeys/registration/finish",
    tag = "passkeys",
    request_body = FinishRegistrationDto,
    responses((status = 201, body = PasskeySummary)),
)]
pub async fn finish_registration(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<FinishRegistrationDto>,
) -> AppResult<(StatusCode, Json<PasskeySummary>)> {
    let name = PasskeyName::parse(&dto.name)?;

    let passkey = PasskeyService::from_state(&state)
        .finish_registration(user.user_id, name, &dto.credential, &client)
        .await?;

    Ok((StatusCode::CREATED, Json(passkey)))
}

#[utoipa::path(
    patch,
    path = "/passkeys/{id}",
    tag = "passkeys",
    params(IdPath),
    request_body = RenamePasskeyDto,
    responses((status = 204)),
)]
pub async fn rename_passkey(
    State(state): State<AppState>,
    user: AuthUser,
    Path(path): Path<IdPath>,
    ValidatedJson(dto): ValidatedJson<RenamePasskeyDto>,
) -> AppResult<StatusCode> {
    let name = PasskeyName::parse(&dto.name)?;

    PasskeyService::from_state(&state)
        .rename(user.user_id, path.id, name)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/passkeys/{id}",
    tag = "passkeys",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn remove_passkey(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
    Path(path): Path<IdPath>,
) -> AppResult<StatusCode> {
    PasskeyService::from_state(&state)
        .remove(user.user_id, path.id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Starts a sign-in with any passkey the browser holds for this site.
#[utoipa::path(
    post,
    path = "/auth/passkey/challenge",
    tag = "passkeys",
    responses((status = 200, body = PasskeyChallengeDto)),
)]
pub async fn start_sign_in(State(state): State<AppState>) -> AppResult<Json<PasskeyChallengeDto>> {
    let (challenge_id, options) = PasskeyService::from_state(&state).start_sign_in().await?;

    Ok(Json(PasskeyChallengeDto {
        challenge_id,
        options,
    }))
}

#[utoipa::path(
    post,
    path = "/auth/passkey/verify",
    tag = "passkeys",
    request_body = SignInDto,
    responses((status = 204)),
)]
pub async fn finish_sign_in(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<SignInDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = PasskeyService::from_state(&state)
        .finish_sign_in(dto.challenge_id, &dto.credential, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}
