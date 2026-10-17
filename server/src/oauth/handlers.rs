use super::{
    dto::*,
    service::{OAUTH_PENDING_COOKIE, OAuthIntent, OAuthService},
};
use crate::{
    auth::dto::SignInResultDto,
    common::{
        client::ClientInfo,
        extractors::{AuthUser, RecentAuth, ValidatedJson},
    },
    config::REFRESH_COOKIE,
    error::AppResult,
    state::AppState,
};
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::Redirect,
};
use axum_extra::extract::CookieJar;

/// Sends the browser to Google to sign in.
#[utoipa::path(
    get,
    path = "/auth/google",
    tag = "oauth",
    responses((status = 307, description = "Redirect to Google")),
)]
pub async fn initiate_google_oauth(State(s): State<AppState>) -> AppResult<(CookieJar, Redirect)> {
    let (url, jar) = OAuthService::from_state(&s).build_google_auth_url(OAuthIntent::Login)?;
    Ok((jar, Redirect::temporary(&url)))
}

/// A POST rather than a navigation: it needs the CSRF check and lets the
/// client refresh an expired access token before the flow starts. A linked
/// Google account is a lasting way in, so it needs a recent sign-in.
#[utoipa::path(
    post,
    path = "/auth/google/link/start",
    tag = "oauth",
    responses((status = 200, body = GoogleAuthUrlDto)),
)]
pub async fn start_google_link(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
) -> AppResult<(CookieJar, Json<GoogleAuthUrlDto>)> {
    let (url, jar) = OAuthService::from_state(&s).build_google_auth_url(OAuthIntent::Link {
        user_id: user.user_id,
    })?;
    Ok((jar, Json(GoogleAuthUrlDto { url })))
}

/// Where Google sends the browser back; it always redirects into the app,
/// with the outcome in the query.
#[utoipa::path(
    get,
    path = "/auth/google/callback",
    tag = "oauth",
    params(OAuthCallbackQuery),
    responses((status = 307, description = "Redirect into the app")),
)]
pub async fn handle_google_callback(
    State(s): State<AppState>,
    client: ClientInfo,
    jar: CookieJar,
    Query(q): Query<OAuthCallbackQuery>,
) -> (CookieJar, Redirect) {
    let state_cookie = jar.get("oauth_state_token").map(|c| c.value());
    let refresh_token = jar.get(REFRESH_COOKIE).map(|c| c.value());

    let (new_jar, url) = OAuthService::from_state(&s)
        .handle_callback(
            q.code.as_deref(),
            q.state.as_deref(),
            q.error.as_deref(),
            state_cookie,
            refresh_token,
            &client,
        )
        .await;

    (new_jar, Redirect::temporary(&url))
}

/// Finishes a Google sign-up the callback could not complete on its own: the
/// user has to accept the terms before an account is created.
#[utoipa::path(
    post,
    path = "/auth/google/signup",
    tag = "oauth",
    request_body = GoogleSignUpDto,
    responses((status = 200, body = SignInResultDto)),
)]
pub async fn sign_up_with_google(
    State(s): State<AppState>,
    client: ClientInfo,
    jar: CookieJar,
    ValidatedJson(_accepted): ValidatedJson<GoogleSignUpDto>,
) -> AppResult<(CookieJar, Json<SignInResultDto>)> {
    let svc = OAuthService::from_state(&s);
    let pending = svc.verify_pending_cookie(jar.get(OAUTH_PENDING_COOKIE).map(|c| c.value()))?;

    let (jar, result) = svc
        .sign_up_with_google(&pending, &client)
        .await?
        .into_parts();

    Ok((jar.add(svc.clear_pending_cookie()), Json(result)))
}

#[utoipa::path(
    delete,
    path = "/auth/google/unlink",
    tag = "oauth",
    responses((status = 204)),
)]
pub async fn unlink_google_account(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<StatusCode> {
    OAuthService::from_state(&s)
        .unlink_google_account(user.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/auth/providers",
    tag = "oauth",
    responses((status = 200, body = Vec<LinkedProviderDto>)),
)]
pub async fn get_linked_providers(
    State(s): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<LinkedProviderDto>>> {
    Ok(Json(
        OAuthService::from_state(&s)
            .get_linked_providers(user.user_id)
            .await?,
    ))
}
