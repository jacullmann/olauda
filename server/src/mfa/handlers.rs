use super::{dto::*, service::MfaService};
use crate::{
    common::{
        client::ClientInfo,
        extractors::{AuthUser, RecentAuth, ValidatedJson},
    },
    error::AppResult,
    state::AppState,
};
use axum::{Json, extract::State, http::StatusCode};

#[utoipa::path(
    get,
    path = "/mfa/status",
    tag = "mfa",
    responses((status = 200, body = MfaStatusDto)),
)]
pub async fn get_mfa_status(
    State(s): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<MfaStatusDto>> {
    Ok(Json(
        MfaService::from_state(&s).get_status(user.user_id).await?,
    ))
}

/// Shows a new secret, so it needs a recent sign-in: otherwise a stolen
/// session could tie the account to the thief's authenticator.
#[utoipa::path(
    post,
    path = "/mfa/setup",
    tag = "mfa",
    responses((status = 200, body = MfaSetupDto)),
)]
pub async fn setup(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
) -> AppResult<Json<MfaSetupDto>> {
    Ok(Json(MfaService::from_state(&s).setup(user.user_id).await?))
}

/// Only a secret from a recent `setup` can be activated, which already
/// required a recent sign-in.
#[utoipa::path(
    post,
    path = "/mfa/activate",
    tag = "mfa",
    request_body = MfaCodeDto,
    responses((status = 200, body = RecoveryCodesDto)),
)]
pub async fn activate(
    State(s): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<MfaCodeDto>,
) -> AppResult<Json<RecoveryCodesDto>> {
    Ok(Json(
        MfaService::from_state(&s)
            .activate(user.user_id, user.session_id, &dto.code, &client)
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/mfa/deactivate",
    tag = "mfa",
    responses((status = 204)),
)]
pub async fn deactivate(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<StatusCode> {
    MfaService::from_state(&s)
        .deactivate(user.user_id, user.session_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/mfa/recovery-codes",
    tag = "mfa",
    responses((status = 200, body = RecoveryCodesDto)),
)]
pub async fn regenerate_recovery_codes(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<Json<RecoveryCodesDto>> {
    Ok(Json(
        MfaService::from_state(&s)
            .regenerate_recovery_codes(user.user_id, &client)
            .await?,
    ))
}
