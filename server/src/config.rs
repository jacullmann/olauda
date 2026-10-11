use anyhow::{Context, Result};
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub cors_origin: String,
    /// `None` issues host-only cookies, so a dev server works under any host
    /// name, such as a LAN IP for testing on a phone.
    pub cookie_domain: Option<String>,
    pub cookie_secure: bool,
    /// Without an email provider, development logs emails instead of failing.
    pub log_unsent_emails: bool,
    pub database_url: String,
    pub user_jwt_secret: String,
    pub password_reset_jwt_secret: String,
    pub mfa_pending_jwt_secret: String,
    pub oauth_pending_jwt_secret: String,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub google_redirect_uri: Option<String>,
    pub encryption_key: String,
    pub user_key_pepper: String,
    pub cloudinary_cloud_name: String,
    pub cloudinary_api_key: String,
    pub cloudinary_api_secret: String,
    pub resend_api_key: String,
    pub email_from: String,
    pub geoip_service_url: String,
    pub hetzner: HetznerConfig,
    pub webauthn: WebauthnConfig,
}

#[derive(Clone)]
pub struct HetznerConfig {
    pub api_token: String,
    pub server_id: u64,
}

impl std::fmt::Debug for HetznerConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HetznerConfig")
            .field("api_token", &"[redacted]")
            .field("server_id", &self.server_id)
            .finish()
    }
}

/// Who passkeys are bound to. The browser checks both against the page the
/// ceremony runs on, so they describe the frontend, not this API.
#[derive(Debug, Clone)]
pub struct WebauthnConfig {
    /// Every passkey is bound to this domain for good: changing it later
    /// makes all registered passkeys unusable.
    pub rp_id: String,
    pub rp_origin: Url,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        // Production passes real env vars and has no .env file. A malformed one
        // must not be skipped silently, which would drop every variable in it.
        if let Err(err) = dotenvy::dotenv()
            && !err.not_found()
        {
            return Err(err).context("Failed to parse .env");
        }

        let node_env = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".into());
        let is_production = node_env == "production";

        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3000".into())
            .parse::<u16>()
            .context("PORT must be a valid port number")?;

        let cookie_secure = std::env::var("COOKIE_SECURE")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(is_production);

        let cors_origin = require("CORS_ORIGIN")?;
        let webauthn = WebauthnConfig::from_env(&cors_origin)?;

        Ok(Self {
            port,
            cors_origin,
            cookie_domain: optional("COOKIE_DOMAIN"),
            cookie_secure,
            log_unsent_emails: !is_production,
            database_url: require("DATABASE_URL")?,
            user_jwt_secret: require_min("USER_JWT_SECRET", 32)?,
            password_reset_jwt_secret: require_min("PASSWORD_RESET_JWT_SECRET", 32)?,
            mfa_pending_jwt_secret: require_min("MFA_PENDING_JWT_SECRET", 32)?,
            oauth_pending_jwt_secret: require_min("OAUTH_PENDING_JWT_SECRET", 32)?,
            google_client_id: std::env::var("GOOGLE_OAUTH_CLIENT_ID").ok(),
            google_client_secret: std::env::var("GOOGLE_OAUTH_CLIENT_SECRET").ok(),
            google_redirect_uri: std::env::var("GOOGLE_OAUTH_REDIRECT_URI").ok(),
            encryption_key: require("ENCRYPTION_KEY")?,
            user_key_pepper: require("USER_KEY_PEPPER")?,
            cloudinary_cloud_name: require("CLOUDINARY_CLOUD_NAME")?,
            cloudinary_api_key: require("CLOUDINARY_API_KEY")?,
            cloudinary_api_secret: require("CLOUDINARY_API_SECRET")?,
            resend_api_key: require("RESEND_API_KEY")?,
            email_from: std::env::var("EMAIL_FROM")
                .unwrap_or_else(|_| "Olauda <noreply@schul-dashboard.com>".into()),
            geoip_service_url: std::env::var("GEOIP_SERVICE_URL")
                .unwrap_or_else(|_| "http://geoip-service:8080".into()),
            hetzner: hetzner_from_env()?,
            webauthn,
        })
    }

    pub fn base_cookie_options(&self) -> BaseCookieOptions {
        BaseCookieOptions {
            domain: self.cookie_domain.clone(),
            secure: self.cookie_secure,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BaseCookieOptions {
    pub domain: Option<String>,
    pub secure: bool,
}

impl WebauthnConfig {
    /// Defaults to the frontend origin from `CORS_ORIGIN` and its host name.
    fn from_env(cors_origin: &str) -> Result<Self> {
        let raw_origin = optional("WEBAUTHN_RP_ORIGIN").unwrap_or_else(|| cors_origin.into());
        let rp_origin = Url::parse(&raw_origin)
            .with_context(|| format!("WEBAUTHN_RP_ORIGIN is not a valid URL: {raw_origin}"))?;

        let rp_id = match optional("WEBAUTHN_RP_ID") {
            Some(rp_id) => rp_id,
            None => rp_origin
                .domain()
                .context("WEBAUTHN_RP_ID must be set when the origin has no domain")?
                .to_owned(),
        };

        Ok(Self { rp_id, rp_origin })
    }
}

/// A variable left blank, as in `.env.example`, counts as unset.
fn optional(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn require(key: &str) -> Result<String> {
    std::env::var(key).with_context(|| format!("Missing required env var: {key}"))
}

fn hetzner_from_env() -> Result<HetznerConfig> {
    Ok(HetznerConfig {
        api_token: require("HETZNER_API_TOKEN")?,
        server_id: require("HETZNER_SERVER_ID")?
            .parse()
            .context("HETZNER_SERVER_ID must be the numeric ID of a Hetzner Cloud server")?,
    })
}

fn require_min(key: &str, min_len: usize) -> Result<String> {
    let val = require(key)?;

    if val.len() < min_len {
        anyhow::bail!("{key} must be at least {min_len} characters long");
    }

    Ok(val)
}

pub const ACCESS_TOKEN_TTL: Duration = Duration::from_secs(15 * 60);
pub const REFRESH_TOKEN_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
/// How long a rotated refresh token may still be exchanged. Parallel refreshes
/// (several tabs, a reload racing an in-flight refresh) legitimately present
/// the same token; only a replay after this window counts as theft.
pub const REFRESH_REUSE_GRACE: Duration = Duration::from_secs(30);
pub const MFA_PENDING_TTL: Duration = Duration::from_secs(5 * 60);
pub const PASSWORD_RESET_TTL: Duration = Duration::from_secs(15 * 60);
pub const PASSWORD_RESET_CODE_TTL: Duration = Duration::from_secs(30 * 60);
pub const EMAIL_VERIFY_TTL: Duration = Duration::from_secs(2 * 24 * 60 * 60);
/// How long a passkey registration or sign-in may take, and the timeout the
/// browser is given for it.
pub const PASSKEY_CEREMONY_TTL: Duration = Duration::from_secs(5 * 60);
/// How recently the user must have proven who they are to perform a sensitive
/// action, such as adding a passkey or turning off two-factor authentication.
pub const REAUTH_WINDOW: Duration = Duration::from_secs(10 * 60);
/// How long the second factor may take after a Google confirmation.
pub const REAUTH_PENDING_TTL: Duration = Duration::from_secs(5 * 60);

/// `chrono` arithmetic counterpart of the TTL constants above. The values are
/// small, fixed multiples of a second, so the conversion is always in range.
pub fn chrono_ttl(ttl: Duration) -> chrono::TimeDelta {
    chrono::TimeDelta::try_seconds(ttl.as_secs() as i64).unwrap_or(chrono::TimeDelta::MAX)
}

pub const ACCESS_COOKIE: &str = "access_token";
pub const REFRESH_COOKIE: &str = "refresh_token";
pub const MFA_PENDING_COOKIE: &str = "mfa_pending_token";
pub const REAUTH_PENDING_COOKIE: &str = "reauth_pending_token";
pub const CSRF_COOKIE: &str = "csrf_token";
pub const CSRF_HEADER: &str = "x-csrf-token";
