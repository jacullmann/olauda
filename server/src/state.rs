use crate::{
    common::{
        cloudinary::Cloudinary, email::EmailService, encryption::EncryptionService,
        hetzner::HetznerCloud, jwt::JwtService,
    },
    config::Config,
    mfa::{recovery_codes::RecoveryCodeHasher, second_factor::SecondFactorKeys},
    passkeys::relying_party,
    realtime::hub::Hub,
};
use anyhow::Context;
use reqwest::Client;
use sqlx::PgPool;
use std::sync::Arc;
use webauthn_rs::Webauthn;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub http: Client,
    pub cloudinary: Cloudinary,
    pub hetzner: HetznerCloud,
    pub jwt: JwtService,
    pub email: EmailService,
    pub encryption: EncryptionService,
    pub recovery_codes: RecoveryCodeHasher,
    pub webauthn: Arc<Webauthn>,
    pub realtime: Hub,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> anyhow::Result<Self> {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("olauda-api/v2")
            .build()
            .expect("Failed to build HTTP client");

        let cloudinary = Cloudinary::new(http.clone(), &config);
        let hetzner = HetznerCloud::new(http.clone(), &config.hetzner);
        let jwt = JwtService::new(&config);

        let email = EmailService::new(
            Some(config.resend_api_key.clone()),
            config.email_from.clone(),
            config.log_unsent_emails,
        );

        let encryption = EncryptionService::new(
            config.encryption_key.clone(),
            config.user_key_pepper.clone(),
        );

        let recovery_codes = RecoveryCodeHasher::new(&config.user_key_pepper);

        let webauthn = relying_party(&config.webauthn).context("Invalid WebAuthn configuration")?;

        Ok(Self {
            db,
            config: Arc::new(config),
            http,
            cloudinary,
            hetzner,
            jwt,
            email,
            encryption,
            recovery_codes,
            webauthn: Arc::new(webauthn),
            realtime: Hub::default(),
        })
    }

    pub fn second_factor_keys(&self) -> SecondFactorKeys<'_> {
        SecondFactorKeys {
            encryption: &self.encryption,
            recovery_codes: &self.recovery_codes,
        }
    }
}

#[cfg(test)]
impl AppState {
    /// A state whose database pool connects only when first used.
    pub fn for_tests() -> Self {
        let config = Config::for_tests();
        let db = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy(&config.database_url)
            .expect("valid database URL");

        Self::new(db, config).expect("valid test configuration")
    }
}
