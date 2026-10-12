use crate::{
    auth::{
        cookies::*,
        dto::*,
        service::{AuthService, LoginResult},
        sign_in_methods::SignInMethods,
        token::{TokenService, *},
    },
    common::{
        client::ClientInfo,
        extractors::{AuthUser, MfaPending, OptionalAuth, RecentAuth, ValidatedJson},
    },
    error::{AppError, AppResult},
    mfa::second_factor::SecondFactorProof,
    passkeys::{dto::SignInDto as PasskeySignInDto, service::PasskeyService},
    state::AppState,
};
use axum::{Json, extract::State};
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde_json::{Value, json};

pub async fn login(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<LoginDto>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let svc = AuthService::from_state(&state);

    match svc.login(dto, &client).await? {
        LoginResult::Success(jar) => Ok((jar, Json(json!({ "ok": true })))),

        LoginResult::MfaRequired(jar) => {
            Ok((jar, Json(json!({ "ok": true, "requiresMfa": true }))))
        }
    }
}

/// Tells the sign-in page whether to offer a passkey besides the code. Only
/// whoever already passed the first factor can ask.
pub async fn get_mfa_challenge(
    State(state): State<AppState>,
    pending: MfaPending,
) -> AppResult<Json<Value>> {
    let expires_in = (pending.expires_at - Utc::now()).num_seconds().max(0);
    let methods = SignInMethods::load(&state.db, pending.user_id).await?;

    Ok(Json(json!({
        "expiresIn": expires_in,
        "passkeyAvailable": methods.passkeys > 0,
    })))
}

pub async fn verify_mfa(
    State(state): State<AppState>,
    pending: MfaPending,
    client: ClientInfo,
    ValidatedJson(proof): ValidatedJson<SecondFactorProof>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let svc = AuthService::from_state(&state);

    let (jar, recovery_codes_left) = svc
        .verify_mfa(&proof, pending.user_id, &pending.email, &client)
        .await?;

    Ok((
        jar,
        Json(json!({ "ok": true, "recoveryCodesLeft": recovery_codes_left })),
    ))
}

pub async fn start_mfa_passkey(
    State(state): State<AppState>,
    pending: MfaPending,
) -> AppResult<Json<Value>> {
    let (challenge_id, options) = PasskeyService::from_state(&state)
        .start_bound_authentication(pending.user_id)
        .await?;

    Ok(Json(
        json!({ "challengeId": challenge_id, "options": options }),
    ))
}

pub async fn verify_mfa_passkey(
    State(state): State<AppState>,
    pending: MfaPending,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<PasskeySignInDto>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let jar = PasskeyService::from_state(&state)
        .finish_second_factor(
            pending.user_id,
            &pending.email,
            dto.challenge_id,
            &dto.credential,
            &client,
        )
        .await?;

    Ok((jar, Json(json!({ "ok": true }))))
}

pub async fn cancel_mfa(
    State(state): State<AppState>,
    jar: CookieJar,
) -> AppResult<(CookieJar, Json<Value>)> {
    let opts = state.config.base_cookie_options();

    let jar = jar.add(clear_mfa_pending_cookie(&opts));

    Ok((jar, Json(json!({ "ok": true }))))
}

pub async fn register(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<RegisterDto>,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.register(dto).await?))
}

pub async fn get_me(State(state): State<AppState>, opt: OptionalAuth) -> AppResult<Json<Value>> {
    match opt.0 {
        None => Ok(Json(json!({ "authenticated": false }))),
        Some(user) => {
            let svc = AuthService::from_state(&state);
            Ok(Json(svc.get_me(user.user_id).await?))
        }
    }
}

pub async fn delete_me(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<(CookieJar, Json<Value>)> {
    let svc = AuthService::from_state(&state);

    let jar = svc.delete_me(user.user_id, &client).await?;

    Ok((jar, Json(json!({ "ok": true }))))
}

/// Entering the emailed code with the password chosen at sign-up creates the
/// account and signs it in.
pub async fn confirm_sign_up(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ConfirmSignUpDto>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let jar = AuthService::from_state(&state)
        .confirm_sign_up(&dto.email, &dto.code, dto.password, &client)
        .await?;

    Ok((jar, Json(json!({ "ok": true }))))
}

pub async fn resend_verification(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<ResendVerificationDto>,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.resend_verification(&dto.email).await?))
}

pub async fn forgot_password(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ForgotPasswordDto>,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.forgot_password(&dto.email, &client).await?))
}

pub async fn verify_reset_token(
    State(state): State<AppState>,
    ValidatedJson(dto): ValidatedJson<ResetPasswordVerifyDto>,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.verify_reset_token(&dto.email, &dto.code).await?))
}

pub async fn reset_password(
    State(state): State<AppState>,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ResetPasswordDto>,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(
        svc.reset_password(&dto.reset_token, &dto.password, &client)
            .await?,
    ))
}

pub async fn change_password(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<ChangePasswordDto>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let svc = AuthService::from_state(&state);

    let (jar, body) = svc
        .change_password(
            user.user_id,
            dto.current_password,
            dto.new_password,
            &client,
        )
        .await?;

    Ok((jar, Json(body)))
}

pub async fn request_password_setup_code(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.request_password_setup_code(user.user_id).await?))
}

pub async fn set_password(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    ValidatedJson(dto): ValidatedJson<SetPasswordDto>,
) -> AppResult<(CookieJar, Json<Value>)> {
    let svc = AuthService::from_state(&state);

    let (jar, body) = svc
        .set_initial_password(user.user_id, &dto.code, dto.new_password, &client)
        .await?;

    Ok((jar, Json(body)))
}

pub async fn get_sign_in_methods(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<SignInMethods>> {
    Ok(Json(SignInMethods::load(&state.db, user.user_id).await?))
}

pub async fn remove_password(
    State(state): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(
        svc.remove_password(user.user_id, user.session_id, &client)
            .await?,
    ))
}

pub async fn get_groups(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let svc = AuthService::from_state(&state);

    Ok(Json(svc.get_groups(user.user_id).await?))
}

pub async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
    client: ClientInfo,
) -> AppResult<(CookieJar, Json<Value>)> {
    use crate::config::REFRESH_COOKIE;

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

    Ok((new_jar, Json(json!({ "ok": true }))))
}

pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
    client: ClientInfo,
) -> AppResult<(CookieJar, Json<Value>)> {
    use crate::config::REFRESH_COOKIE;

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

    Ok((new_jar, Json(json!({ "ok": true }))))
}

pub async fn logout_all(
    State(state): State<AppState>,
    user: AuthUser,
    jar: CookieJar,
    client: ClientInfo,
) -> AppResult<(CookieJar, Json<Value>)> {
    AuthService::from_state(&state)
        .sign_out_everywhere(user.user_id, None, &client)
        .await?;

    let opts = state.config.base_cookie_options();

    let new_jar = jar
        .add(clear_access_cookie(&opts))
        .add(clear_refresh_cookie(&opts));

    Ok((new_jar, Json(json!({ "ok": true }))))
}

pub async fn logout_all_others(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
) -> AppResult<Json<Value>> {
    AuthService::from_state(&state)
        .sign_out_everywhere(user.user_id, Some(user.session_id), &client)
        .await?;

    Ok(Json(json!({ "ok": true })))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Value>> {
    let sessions = TokenService::from_state(&state)
        .list_active_sessions(user.user_id)
        .await?;

    Ok(Json(json!({
        "sessions": sessions,
        "currentFamilyId": user.session_id,
    })))
}

pub async fn revoke_session(
    State(state): State<AppState>,
    user: AuthUser,
    client: ClientInfo,
    axum::extract::Path(family_id): axum::extract::Path<uuid::Uuid>,
) -> AppResult<Json<Value>> {
    let ended = AuthService::from_state(&state)
        .end_session(user.user_id, family_id, &client)
        .await?;

    if !ended {
        return Err(AppError::not_found("Session not found."));
    }

    Ok(Json(json!({ "ok": true })))
}
