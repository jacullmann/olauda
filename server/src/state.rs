use crate::{
    common::{
        cloudinary::Cloudinary, email::EmailService, encryption::EncryptionService,
        hetzner::HetznerCloud, jwt::JwtService,
    },
    config::Config,
    messages::gateway::MessageBus,
    mfa::{recovery_codes::RecoveryCodeHasher, second_factor::SecondFactorKeys},
    passkeys::relying_party,
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
    pub message_bus: MessageBus,
    pub webauthn: Arc<Webauthn>,
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
            message_bus: MessageBus::default(),
            webauthn: Arc::new(webauthn),
        })
    }

    pub fn second_factor_keys(&self) -> SecondFactorKeys<'_> {
        SecondFactorKeys {
            encryption: &self.encryption,
            recovery_codes: &self.recovery_codes,
        }
    }
}
