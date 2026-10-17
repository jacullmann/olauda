use crate::{
    auth::{
        cookies::*,
        dto::*,
        service::AuthService,
        sign_in_methods::SignInMethods,
        token::{TokenService, *},
    },
    common::{
        client::ClientInfo,
        extractors::{AuthUser, MfaPending, OptionalAuth, RecentAuth, ValidatedJson},
    },
    config::REFRESH_COOKIE,
    error::{AppError, AppResult},
    mfa::second_factor::SecondFactorProof,
    passkeys::{
        dto::{PasskeyChallengeDto, SignInDto as PasskeySignInDto},
        service::PasskeyService,
    },
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use uuid::Uuid;

/// Signs in with email and password. An account with two-factor
/// authentication gets a pending sign-in instead of a session.
#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "auth",
    request_body = LoginDto,
    responses((status = 200, body = SignInResultDto)),
)]
pub async fn login(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<LoginDto>,
) -> AppResult<(CookieJar, Json<SignInResultDto>)> {
    let (jar, result) = AuthService::from_state(&state)
        .login(dto, &client)
        .await?
        .into_parts();

    Ok((jar, Json(result)))
}

/// Tells the sign-in page whether to offer a passkey besides the code. Only
/// whoever already passed the first factor can ask.
#[utoipa::path(
    get,
    path = "/auth/mfa/challenge",
    tag = "auth",
    responses((status = 200, body = MfaChallengeDto)),
)]
pub async fn get_mfa_challenge(
    State(state): State<AppState>,
    pending: MfaPending,
) -> AppResult<Json<MfaChallengeDto>> {
    let methods = SignInMethods::load(&state.db, pending.user_id).await?;

    Ok(Json(MfaChallengeDto {
        expires_in: (pending.expires_at - Utc::now()).num_seconds().max(0),
        passkey_available: methods.passkeys > 0,
    }))
}

#[utoipa::path(
    post,
    path = "/auth/mfa/verify",
    tag = "auth",
    request_body = SecondFactorProof,
    responses((status = 200, body = MfaSignInDto)),
)]
pub async fn verify_mfa(
    State(state): State<AppState>,
    pending: MfaPending,
    client: ClientInfo,
    ValidatedJson(proof): ValidatedJson<SecondFactorProof>,
) -> AppResult<(CookieJar, Json<MfaSignInDto>)> {
    let (jar, recovery_codes_left) = AuthService::from_state(&state)
        .verify_mfa(&proof, pending.user_id, &pending.email, &client)
        .await?;

    Ok((
        jar,
        Json(MfaSignInDto {
            recovery_codes_left,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/auth/mfa/passkey/challenge",
    tag = "auth",
    responses((status = 200, body = PasskeyChallengeDto)),
)]
pub async fn start_mfa_passkey(
    State(state): State<AppState>,
    pending: MfaPending,
) -> AppResult<Json<PasskeyChallengeDto>> {
    let (challenge_id, options) = PasskeyService::from_state(&state)
        .start_bound_authentication(pending.user_id)
        .await?;

    Ok(Json(PasskeyChallengeDto {
        challenge_id,
        options,
    }))
}

#[utoipa::path(
    post,
    path = "/auth/mfa/passkey/verify",
    tag = "auth",
    request_body = PasskeySignInDto,
    responses((status = 204)),
)]
pub async fn verify_mfa_passkey(
    State(state): State<AppState>,
    pending: MfaPending,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<PasskeySignInDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = PasskeyService::from_state(&state)
        .finish_second_factor(
            pending.user_id,
            &pending.email,
            dto.challenge_id,
            &dto.credential,
            &client,
        )
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(
    post,
    path = "/auth/mfa/cancel",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn cancel_mfa(State(state): State<AppState>, jar: CookieJar) -> (CookieJar, StatusCode) {
    let opts = state.config.base_cookie_options();

    (
        jar.add(clear_mfa_pending_cookie(&opts)),
        StatusCode::NO_CONTENT,
    )
}

/// Stores the sign-up and mails its confirmation code.
#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "auth",
    request_body = RegisterDto,
    responses((status = 204)),
)]
pub async fn register(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<RegisterDto>,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state).register(dto).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// The signed-in user, or `null` without a session.
#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "auth",
    responses((status = 200, body = Option<CurrentUserDto>)),
)]
pub async fn get_me(
    State(state): State<AppState>,
    OptionalAuth(user): OptionalAuth,
) -> AppResult<Json<Option<CurrentUserDto>>> {
    let Some(user) = user else {
        return Ok(Json(None));
    };

    Ok(Json(
        AuthService::from_state(&state).get_me(user.user_id).await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/auth/me",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn delete_me(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = AuthService::from_state(&state)
        .delete_me(user.user_id, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

/// Entering the emailed code with the password chosen at sign-up creates the
/// account and signs it in.
#[utoipa::path(
    post,
    path = "/auth/verify",
    tag = "auth",
    request_body = ConfirmSignUpDto,
    responses((status = 204)),
)]
pub async fn confirm_sign_up(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ConfirmSignUpDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = AuthService::from_state(&state)
        .confirm_sign_up(&dto.email, &dto.code, dto.password, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

/// Answers the same whether or not a code was sent, so it reveals nothing
/// about the address.
#[utoipa::path(
    post,
    path = "/auth/verify/resend",
    tag = "auth",
    request_body = ResendVerificationDto,
    responses((status = 204)),
)]
pub async fn resend_verification(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<ResendVerificationDto>,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .resend_verification(&dto.email)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Answers the same whether or not the address has an account.
#[utoipa::path(
    post,
    path = "/auth/forgot",
    tag = "auth",
    request_body = ForgotPasswordDto,
    responses((status = 204)),
)]
pub async fn forgot_password(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ForgotPasswordDto>,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .forgot_password(&dto.email, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Trades the emailed code for the token that sets the new password.
#[utoipa::path(
    post,
    path = "/auth/reset/verify",
    tag = "auth",
    request_body = ResetPasswordVerifyDto,
    responses((status = 200, body = ResetTokenDto)),
)]
pub async fn verify_reset_token(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<ResetPasswordVerifyDto>,
) -> AppResult<Json<ResetTokenDto>> {
    let reset_token = AuthService::from_state(&state)
        .verify_reset_token(&dto.email, &dto.code)
        .await?;

    Ok(Json(ResetTokenDto { reset_token }))
}

#[utoipa::path(
    post,
    path = "/auth/reset",
    tag = "auth",
    request_body = ResetPasswordDto,
    responses((status = 204)),
)]
pub async fn reset_password(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ResetPasswordDto>,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .reset_password(&dto.reset_token, &dto.password, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Every other session ends; this one continues with new tokens.
#[utoipa::path(
    post,
    path = "/auth/change-password",
    tag = "auth",
    request_body = ChangePasswordDto,
    responses((status = 204)),
)]
pub async fn change_password(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ChangePasswordDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = AuthService::from_state(&state)
        .change_password(
            user.user_id,
            dto.current_password,
            dto.new_password,
            &client,
        )
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

/// Mails the code that lets a passwordless account set its first password.
#[utoipa::path(
    post,
    path = "/auth/set-password/code",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn request_password_setup_code(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .request_password_setup_code(user.user_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/auth/set-password",
    tag = "auth",
    request_body = SetPasswordDto,
    responses((status = 204)),
)]
pub async fn set_password(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<SetPasswordDto>,
) -> AppResult<(CookieJar, StatusCode)> {
    let jar = AuthService::from_state(&state)
        .set_initial_password(user.user_id, &dto.code, dto.new_password, &client)
        .await?;

    Ok((jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(
    get,
    path = "/auth/sign-in-methods",
    tag = "auth",
    responses((status = 200, body = SignInMethods)),
)]
pub async fn get_sign_in_methods(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<SignInMethods>> {
    Ok(Json(SignInMethods::load(&state.db, user.user_id).await?))
}

#[utoipa::path(
    delete,
    path = "/auth/password",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn remove_password(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .remove_password(user.user_id, user.session_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Rotates the session's tokens, which share one cookie across tabs.
#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
    client: ClientInfo,
) -> AppResult<(CookieJar, StatusCode)> {
    let presented = jar
        .get(REFRESH_COOKIE)
        .map(|c| c.value())
        .filter(|token| !token.is_empty());

    let rotated = match presented {
        Some(token) => {
            TokenService::from_state(&state)
                .rotate(token, &client)
                .await?
        }
        None => Err(RefreshRejection::Missing),
    };

    let issued = rotated.map_err(|rejection| {
        // Every visitor without a session asks once at startup; only the end
        // of an existing session is worth reading in the logs.
        if rejection == RefreshRejection::Missing {
            tracing::debug!("Refresh without a session cookie");
        } else {
            tracing::info!(?rejection, "Refresh rejected, the client is signed out");
        }
        AppError::Unauthorized("Refresh token invalid.".into())
    })?;

    let opts = state.config.base_cookie_options();

    let new_jar = jar
        .add(access_cookie(issued.access_token, &opts))
        .add(refresh_cookie(issued.refresh_token, &opts));

    Ok((new_jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
    client: ClientInfo,
) -> (CookieJar, StatusCode) {
    // Signing out always clears the cookies, even if ending the session
    // on the server failed.
    if let Some(token) = jar.get(REFRESH_COOKIE).map(|c| c.value())
        && !token.is_empty()
        && let Err(e) = AuthService::from_state(&state)
            .sign_out(token, &client)
            .await
    {
        tracing::warn!("Session not ended on sign-out: {e}");
    }

    let opts = state.config.base_cookie_options();

    let new_jar = jar
        .add(clear_access_cookie(&opts))
        .add(clear_refresh_cookie(&opts));

    (new_jar, StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/auth/logout-all",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn logout_all(
    State(state): State<AppState>,
    user: AuthUser,
    jar: CookieJar,
    client: ClientInfo,
) -> AppResult<(CookieJar, StatusCode)> {
    AuthService::from_state(&state)
        .sign_out_everywhere(user.user_id, None, &client)
        .await?;

    let opts = state.config.base_cookie_options();

    let new_jar = jar
        .add(clear_access_cookie(&opts))
        .add(clear_refresh_cookie(&opts));

    Ok((new_jar, StatusCode::NO_CONTENT))
}

#[utoipa::path(
    post,
    path = "/auth/logout-others",
    tag = "auth",
    responses((status = 204)),
)]
pub async fn logout_all_others(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
) -> AppResult<StatusCode> {
    AuthService::from_state(&state)
        .sign_out_everywhere(user.user_id, Some(user.session_id), &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/auth/sessions",
    tag = "auth",
    responses((status = 200, body = SessionListDto)),
)]
pub async fn list_sessions(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<SessionListDto>> {
    let sessions = TokenService::from_state(&state)
        .list_active_sessions(user.user_id)
        .await?;

    Ok(Json(SessionListDto {
        sessions,
        current_family_id: user.session_id,
    }))
}

#[utoipa::path(
    delete,
    path = "/auth/sessions/{family_id}",
    tag = "auth",
    params(("family_id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn revoke_session(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    Path(family_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let ended = AuthService::from_state(&state)
        .end_session(user.user_id, family_id, &client)
        .await?;

    if !ended {
        return Err(AppError::not_found("Session not found."));
    }

    Ok(StatusCode::NO_CONTENT)
}
