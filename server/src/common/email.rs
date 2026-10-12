mod messages;
mod render;
mod stats;

pub use messages::SecurityNotice;
pub use stats::{EmailActivity, EmailQuota, EmailStatsError};

use crate::{
    auth::email_code::EmailCode,
    common::locale::Locale,
    config::{EMAIL_VERIFY_TTL, PASSWORD_RESET_CODE_TTL},
    error::AppError,
};
use messages::Message;
use resend_rs::{Resend, types::CreateEmailBaseOptions};
use tracing::{info, warn};

#[derive(Clone)]
pub struct EmailService {
    resend: Option<Resend>,
    from: String,
    log_unsent: bool,
}

impl EmailService {
    pub fn new(api_key: Option<String>, from: String, log_unsent: bool) -> Self {
        let resend = api_key.and_then(|k| {
            if k.is_empty() {
                warn!("RESEND_API_KEY is empty — emails will not be sent.");
                None
            } else {
                Some(Resend::new(&k))
            }
        });

        if resend.is_none() {
            warn!("Email service not configured — emails will not be sent.");
        }

        Self {
            resend,
            from,
            log_unsent,
        }
    }

    async fn send(&self, to: &str, message: Message) -> Result<(), AppError> {
        let Some(resend) = self.resend.as_ref() else {
            // Emails carry sign-in codes, so only development may log them.
            if self.log_unsent {
                info!(to, subject = %message.subject, body = %message.to_text(), "Email not sent");
                return Ok(());
            }
            return Err(AppError::internal("Email service not configured."));
        };

        let email = CreateEmailBaseOptions::new(&self.from, [to], &message.subject)
            .with_html(&message.to_html())
            .with_text(&message.to_text());

        resend
            .emails
            .send(email)
            .await
            .map_err(|e| AppError::internal(format!("Email delivery failed: {e}")))?;

        Ok(())
    }

    pub async fn send_verification_email(
        &self,
        to: &str,
        locale: Locale,
        code: &EmailCode,
    ) -> Result<(), AppError> {
        let valid_hours = EMAIL_VERIFY_TTL.as_secs() / 3600;
        self.send(
            to,
            Message::verification(locale, code.as_str(), valid_hours),
        )
        .await
    }

    pub async fn send_password_reset_email(
        &self,
        to: &str,
        locale: Locale,
        code: &EmailCode,
    ) -> Result<(), AppError> {
        let valid_minutes = PASSWORD_RESET_CODE_TTL.as_secs() / 60;
        self.send(
            to,
            Message::password_reset(locale, code.as_str(), valid_minutes),
        )
        .await
    }

    pub async fn send_password_setup_email(
        &self,
        to: &str,
        locale: Locale,
        code: &EmailCode,
    ) -> Result<(), AppError> {
        let valid_minutes = PASSWORD_RESET_CODE_TTL.as_secs() / 60;
        self.send(
            to,
            Message::password_setup(locale, code.as_str(), valid_minutes),
        )
        .await
    }

    pub async fn send_security_notice(
        &self,
        to: &str,
        locale: Locale,
        event: SecurityNotice,
    ) -> Result<(), AppError> {
        self.send(to, Message::security_notice(locale, event)).await
    }
}
