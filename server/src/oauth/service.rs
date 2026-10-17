use crate::{
    access_control,
    auth::{
        security_notice,
        service::{AuthService, LoginResult, security_changed},
        session_context::account_is_active,
        sign_in_methods::{SignInMethod, SignInMethods},
    },
    common::{
        client::ClientInfo,
        email::SecurityNotice,
        jwt::{hs256_validation, now_secs},
    },
    config::Config,
    error::{AppError, AppResult},
    oauth::dto::LinkedProviderDto,
    realtime::event::publish,
    reauth::service::{GoogleReauth, ReauthService},
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use axum_extra::extract::{CookieJar, cookie::Cookie, cookie::SameSite};
use cookie::time::Duration;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

const OAUTH_STATE_COOKIE: &str = "oauth_state_token";
pub const OAUTH_PENDING_COOKIE: &str = "oauth_pending_token";

/// The cookie and the JWT inside it expire together.
const STATE_COOKIE_TTL_MINS: i64 = 10;
const PENDING_COOKIE_TTL_MINS: i64 = 15;
const STATE_COOKIE_TTL_SECS: u64 = STATE_COOKIE_TTL_MINS as u64 * 60;
const PENDING_COOKIE_TTL_SECS: u64 = PENDING_COOKIE_TTL_MINS as u64 * 60;

/// Query parameter under which the frontend reads the result of a sign-in.
const LOGIN_RESULT_PARAM: &str = "auth";
/// Query parameter under which the frontend reads the result of a link from
/// the account settings.
const LINK_RESULT_PARAM: &str = "link";
/// Query parameter under which the frontend reads the result of confirming a
/// sensitive action with Google.
const REAUTH_RESULT_PARAM: &str = "reauth";

const GOOGLE_ACCOUNT_TAKEN_CONSTRAINT: &str = "oauth_accounts_provider_provider_user_id_key";
const PROVIDER_ALREADY_LINKED_CONSTRAINT: &str = "oauth_accounts_user_id_provider_key";

/// Why the user went to Google. It travels inside the signed state cookie, so
/// only a request authenticated as `user_id` can make the callback link a
/// Google account to that user.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(tag = "intent", rename_all = "snake_case")]
pub enum OAuthIntent {
    /// Signs in, or starts a sign-up when neither the Google account nor its
    /// email is known.
    Login,
    Link {
        user_id: Uuid,
    },
    /// Confirms a sensitive action with the Google account linked to the user.
    Reauth {
        user_id: Uuid,
    },
}

impl OAuthIntent {
    fn result_param(&self) -> &'static str {
        match self {
            Self::Login => LOGIN_RESULT_PARAM,
            Self::Link { .. } => LINK_RESULT_PARAM,
            Self::Reauth { .. } => REAUTH_RESULT_PARAM,
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct OAuthStateClaims {
    state: String,
    nonce: String,
    #[serde(flatten)]
    intent: OAuthIntent,
    purpose: String,
    iat: u64,
    exp: u64,
}

struct GoogleProfile {
    subject: String,
    email: String,
}

/// How a Google identity came to be linked, as the security log records it.
#[derive(Debug, Clone, Copy)]
enum GoogleLinkVia {
    /// The user linked it in their account settings.
    Settings,
    /// A Google sign-in matched the account's email and linked it.
    SignIn,
}

impl GoogleLinkVia {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Settings => "settings",
            Self::SignIn => "sign_in",
        }
    }
}

enum LinkError {
    GoogleAccountTaken,
    ProviderAlreadyLinked,
    Database(sqlx::Error),
}

impl LinkError {
    fn reason(&self) -> &'static str {
        match self {
            Self::GoogleAccountTaken => "google_account_taken",
            Self::ProviderAlreadyLinked => "provider_already_linked",
            Self::Database(_) => "server_error",
        }
    }
}

impl From<sqlx::Error> for LinkError {
    fn from(e: sqlx::Error) -> Self {
        match e.as_database_error().and_then(|db| db.constraint()) {
            Some(GOOGLE_ACCOUNT_TAKEN_CONSTRAINT) => Self::GoogleAccountTaken,
            Some(PROVIDER_ALREADY_LINKED_CONSTRAINT) => Self::ProviderAlreadyLinked,
            _ => Self::Database(e),
        }
    }
}

impl From<LinkError> for AppError {
    fn from(e: LinkError) -> Self {
        match e {
            LinkError::GoogleAccountTaken => {
                AppError::bad_request("This Google account is already linked to an account.")
            }
            LinkError::ProviderAlreadyLinked => {
                AppError::bad_request("This account is already linked to a Google account.")
            }
            LinkError::Database(e) => AppError::Database(e),
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct OAuthPendingClaims {
    pub google_id: String,
    pub google_email: String,
    pub iat: u64,
    pub exp: u64,
}

pub struct OAuthService {
    db: PgPool,
    config: Arc<Config>,
    http: reqwest::Client,
    state: AppState,
}

impl OAuthService {
    pub fn from_state(s: &AppState) -> Self {
        Self {
            db: s.db.clone(),
            config: s.config.clone(),
            http: s.http.clone(),
            state: s.clone(),
        }
    }

    pub fn build_google_auth_url(&self, intent: OAuthIntent) -> AppResult<(String, CookieJar)> {
        let state_bytes: [u8; 32] = rand::random();

        let state_val = hex::encode(state_bytes);

        let nonce_bytes: [u8; 32] = rand::random();

        let nonce = hex::encode(nonce_bytes);

        let token = self.sign_state_cookie(&state_val, &nonce, intent)?;

        let opts = self.config.base_cookie_options();

        let mut c = Cookie::new(OAUTH_STATE_COOKIE, token);
        c.set_http_only(true);
        c.set_secure(opts.secure);
        c.set_path("/");
        c.set_same_site(SameSite::Lax);
        c.set_max_age(Duration::minutes(STATE_COOKIE_TTL_MINS));

        let client_id = self.config.google_client_id.as_deref().unwrap_or("");

        let redirect = self.config.google_redirect_uri.as_deref().unwrap_or("");

        let params = [
            ("client_id", client_id),
            ("redirect_uri", redirect),
            ("response_type", "code"),
            ("scope", "openid email"),
            ("state", &state_val),
            ("nonce", &nonce),
            ("access_type", "online"),
            ("prompt", "select_account"),
        ];
        let url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?{}",
            params
                .iter()
                .map(|(k, v)| format!("{k}={}", urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&")
        );

        Ok((url, CookieJar::new().add(c)))
    }

    /// `refresh_token` names the session a confirmation with Google is for.
    pub async fn handle_callback(
        &self,
        code: Option<&str>,
        state_param: Option<&str>,
        error_param: Option<&str>,
        state_cookie: Option<&str>,
        refresh_token: Option<&str>,
        client: &ClientInfo,
    ) -> (CookieJar, String) {
        let empty_jar = CookieJar::new();

        let Some(state_param) = state_param else {
            return (
                empty_jar,
                self.error_url(LOGIN_RESULT_PARAM, "invalid_request"),
            );
        };

        // The state is verified first so that every later result, including a
        // cancelled consent screen, reaches the page the flow started from.
        let state = match self.verify_state_cookie(state_cookie, state_param) {
            Ok(s) => s,
            Err(_) => {
                return (
                    empty_jar,
                    self.error_url(LOGIN_RESULT_PARAM, "invalid_state"),
                );
            }
        };

        let result_param = state.intent.result_param();

        if error_param == Some("access_denied") {
            return (empty_jar, self.error_url(result_param, "access_denied"));
        }

        let Some(code) = code else {
            return (empty_jar, self.error_url(result_param, "invalid_request"));
        };

        let id_token = match self.exchange_code(code).await {
            Ok(t) => t,
            Err(_) => {
                return (
                    empty_jar,
                    self.error_url(result_param, "token_exchange_failed"),
                );
            }
        };

        let profile = match self.verify_id_token(&id_token, &state.nonce).await {
            Ok(p) => p,
            Err(_) => return (empty_jar, self.error_url(result_param, "token_invalid")),
        };

        match state.intent {
            OAuthIntent::Login => self.complete_login(&profile, client).await,
            OAuthIntent::Link { user_id } => (
                empty_jar,
                self.complete_link(user_id, &profile, client).await,
            ),
            OAuthIntent::Reauth { user_id } => {
                self.complete_reauth(user_id, &profile, refresh_token, client)
                    .await
            }
        }
    }

    async fn complete_reauth(
        &self,
        user_id: Uuid,
        profile: &GoogleProfile,
        refresh_token: Option<&str>,
        client: &ClientInfo,
    ) -> (CookieJar, String) {
        let outcome = ReauthService::from_state(&self.state)
            .after_google(user_id, &profile.subject, refresh_token, client)
            .await;

        match outcome {
            Ok(GoogleReauth::Confirmed(jar)) => {
                (jar, self.result_url(REAUTH_RESULT_PARAM, "success"))
            }
            Ok(GoogleReauth::SecondFactorPending(jar)) => {
                (jar, self.result_url(REAUTH_RESULT_PARAM, "second-factor"))
            }
            Err(e) => {
                let reason = match e {
                    AppError::TokenExpired => "session_expired",
                    AppError::Auth(_) => "google_account_mismatch",
                    _ => {
                        tracing::error!(error = ?e, "Google confirmation failed");
                        "server_error"
                    }
                };
                (
                    CookieJar::new(),
                    self.error_url(REAUTH_RESULT_PARAM, reason),
                )
            }
        }
    }

    async fn complete_login(
        &self,
        profile: &GoogleProfile,
        client: &ClientInfo,
    ) -> (CookieJar, String) {
        let server_error = || {
            (
                CookieJar::new(),
                self.error_url(LOGIN_RESULT_PARAM, "server_error"),
            )
        };

        let account = match self.resolve_account(profile, client).await {
            Ok(Some(account)) => account,
            Ok(None) => {
                // Told now rather than after the sign-up form was filled in.
                if let Err(e) = access_control::ensure_registration_open(&self.db).await {
                    return self.login_failure(&e);
                }
                return match self.sign_up_jar(profile) {
                    Ok(jar) => (jar, self.result_url(LOGIN_RESULT_PARAM, "signup-required")),
                    Err(_) => server_error(),
                };
            }
            Err(e) => {
                if let LinkError::Database(db_err) = &e {
                    tracing::error!(error = %db_err, "failed to resolve google account");
                }
                return (
                    CookieJar::new(),
                    self.error_url(LOGIN_RESULT_PARAM, e.reason()),
                );
            }
        };

        let sign_in = self
            .auth()
            .complete_sign_in(
                account.user_id,
                &account.email,
                account.mfa_required,
                SignInMethod::Google,
                client,
            )
            .await;

        match sign_in {
            Ok(LoginResult::Success(jar)) => (jar, self.result_url(LOGIN_RESULT_PARAM, "success")),
            Ok(LoginResult::MfaRequired(jar)) => {
                (jar, self.result_url(LOGIN_RESULT_PARAM, "mfa-pending"))
            }
            Err(e) => self.login_failure(&e),
        }
    }

    /// Paused sign-ups and shutdown get their own reason, so the login page
    /// can say why instead of reporting a failure.
    fn login_failure(&self, error: &AppError) -> (CookieJar, String) {
        let reason = match error {
            AppError::RegistrationPaused => "registration_paused",
            AppError::Shutdown => "shutdown",
            _ => "server_error",
        };
        (CookieJar::new(), self.error_url(LOGIN_RESULT_PARAM, reason))
    }

    fn sign_up_jar(&self, profile: &GoogleProfile) -> AppResult<CookieJar> {
        let pending_token = self.sign_pending_cookie(profile)?;
        Ok(CookieJar::new()
            .add(self.pending_cookie(pending_token, Duration::minutes(PENDING_COOKIE_TTL_MINS))))
    }

    /// Sent with a successful sign-up, so a finished flow cannot be repeated
    /// from the same browser.
    pub fn clear_pending_cookie(&self) -> Cookie<'static> {
        self.pending_cookie(String::new(), Duration::ZERO)
    }

    fn pending_cookie(&self, value: String, max_age: Duration) -> Cookie<'static> {
        let opts = self.config.base_cookie_options();

        let mut c = Cookie::new(OAUTH_PENDING_COOKIE, value);
        c.set_http_only(true);
        c.set_secure(opts.secure);
        c.set_path("/");
        c.set_same_site(SameSite::Lax);
        c.set_max_age(max_age);
        c
    }

    /// The Google identity the callback verified for a sign-up, if the
    /// pending cookie has not expired.
    pub fn verify_pending_cookie(&self, token: Option<&str>) -> AppResult<OAuthPendingClaims> {
        token
            .and_then(|token| {
                decode_pending_claims(token, self.config.oauth_pending_jwt_secret.as_bytes())
            })
            .ok_or_else(|| AppError::Unauthorized("Authentication failed.".into()))
    }

    fn auth(&self) -> AuthService {
        AuthService::from_state(&self.state)
    }

    /// Links by Google subject, so the Google email may differ from the
    /// account email: the signed-in session already proves who the user is.
    async fn complete_link(
        &self,
        user_id: Uuid,
        profile: &GoogleProfile,
        client: &ClientInfo,
    ) -> String {
        match account_is_active(&self.db, user_id).await {
            Ok(true) => {}
            Ok(false) => return self.error_url(LINK_RESULT_PARAM, "session_expired"),
            Err(_) => return self.error_url(LINK_RESULT_PARAM, "server_error"),
        }

        let linked = self
            .link_google(user_id, profile, GoogleLinkVia::Settings, client)
            .await;

        match linked {
            Ok(()) => {
                security_notice::notify(
                    &self.db,
                    &self.state.email,
                    user_id,
                    SecurityNotice::GoogleLinked,
                );
                self.result_url(LINK_RESULT_PARAM, "success")
            }
            Err(e) => {
                if let LinkError::Database(db_err) = &e {
                    tracing::error!(error = %db_err, "failed to link google account");
                }
                self.error_url(LINK_RESULT_PARAM, e.reason())
            }
        }
    }

    async fn link_google(
        &self,
        user_id: Uuid,
        profile: &GoogleProfile,
        via: GoogleLinkVia,
        client: &ClientInfo,
    ) -> Result<(), LinkError> {
        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email)
               VALUES ($1, 'google', $2, $3)"#,
            user_id,
            profile.subject,
            profile.email
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::GoogleLinked)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(json!({ "via": via.as_str(), "googleEmail": profile.email }))
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;
        Ok(())
    }

    fn result_url(&self, param: &str, result: &str) -> String {
        format!("{}/?{param}={result}", self.config.cors_origin)
    }

    fn error_url(&self, param: &str, reason: &str) -> String {
        format!("{}/?{param}=error&reason={reason}", self.config.cors_origin)
    }

    /// Creates the account a new Google user confirmed after the callback.
    /// Google has verified the email, so the account starts verified.
    pub async fn sign_up_with_google(
        &self,
        pending: &OAuthPendingClaims,
        client: &ClientInfo,
    ) -> AppResult<LoginResult> {
        access_control::ensure_registration_open(&self.db).await?;

        let email = &pending.google_email;
        let mut tx = self.db.begin().await?;

        let user_id = sqlx::query_scalar!(
            r#"INSERT INTO users (email, password_hash)
               VALUES ($1, NULL) RETURNING id"#,
            email,
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(account_exists_on_conflict)?;

        sqlx::query!(
            r#"INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email)
               VALUES ($1, 'google', $2, $3)"#,
            user_id,
            pending.google_id,
            email
        )
        .execute(&mut *tx)
        .await
        .map_err(account_exists_on_conflict)?;

        SecurityEvent::new(SecurityEventKind::AccountCreated)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(json!({ "method": SignInMethod::Google.as_str() }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        self.auth()
            .complete_sign_in(user_id, email, false, SignInMethod::Google, client)
            .await
    }

    pub async fn unlink_google_account(&self, user_id: Uuid, client: &ClientInfo) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        SignInMethods::lock(&mut tx, user_id)
            .await?
            .ensure_one_left_without(SignInMethod::Google)?;

        let unlinked = sqlx::query!(
            r#"DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = 'google'"#,
            user_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if unlinked > 0 {
            SecurityEvent::new(SecurityEventKind::GoogleUnlinked)
                .user(user_id)
                .actor(user_id)
                .client(client)
                .record(&mut *tx)
                .await?;
            publish(&mut *tx, [security_changed(user_id)]).await?;
        }

        tx.commit().await?;

        if unlinked > 0 {
            security_notice::notify(
                &self.db,
                &self.state.email,
                user_id,
                SecurityNotice::GoogleUnlinked,
            );
        }

        Ok(())
    }

    pub async fn get_linked_providers(&self, user_id: Uuid) -> AppResult<Vec<LinkedProviderDto>> {
        let rows = sqlx::query!(
            r#"SELECT provider, provider_email FROM oauth_accounts WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| LinkedProviderDto {
                provider: r.provider,
                email: r.provider_email,
            })
            .collect())
    }

    /// The account the Google identity signs in to, or `None` when no account
    /// has it or its email yet. An account that only shares the email gets the
    /// Google identity linked right away: Google verified the address, and
    /// every account here proved it at sign-up and cannot change it, so both
    /// belong to the same person.
    async fn resolve_account(
        &self,
        profile: &GoogleProfile,
        client: &ClientInfo,
    ) -> Result<Option<SignInAccount>, LinkError> {
        let linked = sqlx::query!(
            r#"SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = $1"#,
            profile.subject
        )
            .fetch_optional(&self.db)
            .await?;

        if let Some(row) = linked {
            let user = sqlx::query!(
                r#"SELECT id, email, mfa_enabled AND mfa_secret IS NOT NULL AS "mfa_required!"
                   FROM users WHERE id = $1"#,
                row.user_id
            )
            .fetch_one(&self.db)
            .await?;

            return Ok(Some(SignInAccount {
                user_id: user.id,
                email: user.email,
                mfa_required: user.mfa_required,
            }));
        }

        let Some(user) = sqlx::query!(
            r#"SELECT id, email, mfa_enabled AND mfa_secret IS NOT NULL AS "mfa_required!"
               FROM users WHERE email = $1"#,
            profile.email.to_lowercase()
        )
        .fetch_optional(&self.db)
        .await?
        else {
            return Ok(None);
        };

        self.link_google(user.id, profile, GoogleLinkVia::SignIn, client)
            .await?;
        security_notice::notify(
            &self.db,
            &self.state.email,
            user.id,
            SecurityNotice::GoogleLinked,
        );

        // Linking opens no way around the second factor: signing in with
        // Google still demands it.
        Ok(Some(SignInAccount {
            user_id: user.id,
            email: user.email,
            mfa_required: user.mfa_required,
        }))
    }

    async fn exchange_code(&self, code: &str) -> AppResult<String> {
        let params = [
            ("code", code),
            (
                "client_id",
                self.config.google_client_id.as_deref().unwrap_or(""),
            ),
            (
                "client_secret",
                self.config.google_client_secret.as_deref().unwrap_or(""),
            ),
            (
                "redirect_uri",
                self.config.google_redirect_uri.as_deref().unwrap_or(""),
            ),
            ("grant_type", "authorization_code"),
        ];

        let resp = self
            .http
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::internal(format!("Token exchange failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(AppError::internal("Google token exchange failed"));
        }

        let data: Value = resp
            .json()
            .await
            .map_err(|_| AppError::internal("Failed to parse token response"))?;

        Ok(data["id_token"].as_str().unwrap_or("").to_string())
    }

    async fn verify_id_token(
        &self,
        id_token: &str,
        expected_nonce: &str,
    ) -> AppResult<GoogleProfile> {
        let parts: Vec<&str> = id_token.split('.').collect();

        if parts.len() != 3 {
            return Err(AppError::Unauthorized("Malformed ID token.".into()));
        }

        let payload =
            base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, parts[1])
                .map_err(|_| AppError::Unauthorized("Invalid token encoding.".into()))?;

        let claims: Value = serde_json::from_slice(&payload)
            .map_err(|_| AppError::Unauthorized("Invalid token payload.".into()))?;

        let sub = claims["sub"].as_str().unwrap_or("").to_string();

        let email = claims["email"].as_str().unwrap_or("").to_string();

        if sub.is_empty() || email.is_empty() {
            return Err(AppError::Unauthorized(
                "ID token missing subject or email.".into(),
            ));
        }

        let nonce = claims["nonce"].as_str().unwrap_or("");

        let email_verified = claims["email_verified"].as_bool().unwrap_or(false);

        let aud = claims["aud"].as_str().unwrap_or("");
        let expected_aud = self.config.google_client_id.as_deref().unwrap_or("");
        if expected_aud.is_empty() || aud != expected_aud {
            return Err(AppError::Unauthorized("ID token audience mismatch.".into()));
        }

        let iss = claims["iss"].as_str().unwrap_or("");
        if iss != "accounts.google.com" && iss != "https://accounts.google.com" {
            return Err(AppError::Unauthorized("ID token issuer mismatch.".into()));
        }

        if !email_verified {
            return Err(AppError::Unauthorized("Google email not verified.".into()));
        }
        if nonce != expected_nonce {
            return Err(AppError::Unauthorized("Nonce mismatch.".into()));
        }

        let exp = claims["exp"].as_i64().unwrap_or(0);

        if exp < chrono::Utc::now().timestamp() {
            return Err(AppError::Unauthorized("ID token expired.".into()));
        }

        Ok(GoogleProfile {
            subject: sub,
            email,
        })
    }

    fn sign_oauth_cookie<T: serde::Serialize>(&self, claims: &T) -> AppResult<String> {
        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            claims,
            &jsonwebtoken::EncodingKey::from_secret(
                self.config.oauth_pending_jwt_secret.as_bytes(),
            ),
        )
        .map_err(|e| AppError::internal(e.to_string()))
    }

    fn sign_state_cookie(
        &self,
        state: &str,
        nonce: &str,
        intent: OAuthIntent,
    ) -> AppResult<String> {
        let now = now_secs();

        self.sign_oauth_cookie(&OAuthStateClaims {
            state: state.to_string(),
            nonce: nonce.to_string(),
            intent,
            purpose: "oauth_state".into(),
            iat: now,
            exp: now + STATE_COOKIE_TTL_SECS,
        })
    }

    fn sign_pending_cookie(&self, profile: &GoogleProfile) -> AppResult<String> {
        let now = now_secs();

        self.sign_oauth_cookie(&OAuthPendingClaims {
            google_id: profile.subject.clone(),
            google_email: profile.email.to_lowercase(),
            iat: now,
            exp: now + PENDING_COOKIE_TTL_SECS,
        })
    }

    fn verify_state_cookie(
        &self,
        cookie: Option<&str>,
        state_param: &str,
    ) -> AppResult<OAuthStateClaims> {
        let token =
            cookie.ok_or_else(|| AppError::Unauthorized("OAuth state cookie missing.".into()))?;

        let data = jsonwebtoken::decode::<OAuthStateClaims>(
            token,
            &jsonwebtoken::DecodingKey::from_secret(
                self.config.oauth_pending_jwt_secret.as_bytes(),
            ),
            &hs256_validation(),
        )
        .map_err(|_| AppError::Unauthorized("Invalid OAuth state.".into()))?;

        if data.claims.purpose != "oauth_state" || data.claims.state != state_param {
            return Err(AppError::Unauthorized("OAuth state mismatch.".into()));
        }

        Ok(data.claims)
    }
}

struct SignInAccount {
    user_id: Uuid,
    email: String,
    mfa_required: bool,
}

fn decode_pending_claims(token: &str, secret: &[u8]) -> Option<OAuthPendingClaims> {
    jsonwebtoken::decode::<OAuthPendingClaims>(
        token,
        &jsonwebtoken::DecodingKey::from_secret(secret),
        &hs256_validation(),
    )
    .ok()
    .map(|data| data.claims)
}

/// An account for the email or the Google identity appeared after the
/// callback, e.g. through a parallel email registration.
fn account_exists_on_conflict(err: sqlx::Error) -> AppError {
    match err.as_database_error() {
        Some(db) if db.is_unique_violation() => {
            AppError::bad_request("An account with this email address already exists.")
        }
        _ => AppError::Database(err),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state_claims(intent: OAuthIntent) -> OAuthStateClaims {
        OAuthStateClaims {
            state: "state".into(),
            nonce: "nonce".into(),
            intent,
            purpose: "oauth_state".into(),
            iat: 0,
            exp: 0,
        }
    }

    fn round_trip(intent: OAuthIntent) -> OAuthIntent {
        let json = serde_json::to_string(&state_claims(intent)).unwrap();
        serde_json::from_str::<OAuthStateClaims>(&json)
            .unwrap()
            .intent
    }

    #[test]
    fn link_intent_keeps_its_user_through_the_state_cookie() {
        let user_id = Uuid::new_v4();

        assert!(matches!(
            round_trip(OAuthIntent::Link { user_id }),
            OAuthIntent::Link { user_id: decoded } if decoded == user_id
        ));
        assert!(matches!(round_trip(OAuthIntent::Login), OAuthIntent::Login));
    }

    #[test]
    fn state_without_intent_is_rejected() {
        let json = r#"{"state":"s","nonce":"n","purpose":"oauth_state","iat":0,"exp":0}"#;
        assert!(serde_json::from_str::<OAuthStateClaims>(json).is_err());
    }

    fn pending_token(secret: &[u8]) -> String {
        let now = now_secs();
        let claims = OAuthPendingClaims {
            google_id: "google-subject".into(),
            google_email: "user@example.com".into(),
            iat: now,
            exp: now + PENDING_COOKIE_TTL_SECS,
        };
        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(secret),
        )
        .unwrap()
    }

    #[test]
    fn pending_tokens_need_the_server_secret() {
        let secret = b"0123456789abcdef0123456789abcdef";
        let sign_up = pending_token(secret);

        assert!(decode_pending_claims(&sign_up, secret).is_some());
        assert!(decode_pending_claims(&sign_up, b"another-secret").is_none());
    }

    #[test]
    fn link_results_return_to_the_settings_flow() {
        assert_eq!(OAuthIntent::Login.result_param(), LOGIN_RESULT_PARAM);
        assert_eq!(
            OAuthIntent::Link {
                user_id: Uuid::new_v4()
            }
            .result_param(),
            LINK_RESULT_PARAM
        );
    }
}
