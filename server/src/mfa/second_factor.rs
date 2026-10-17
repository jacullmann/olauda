//! Checks a proof of the second factor: a code from the authenticator app, or
//! one of the recovery codes that stand in for it.
//!
//! Both are guessable in principle, so wrong ones are counted per account
//! rather than per IP address (see [`lockout`]); an attacker who knows the
//! password could otherwise spread guesses over as many addresses as they
//! control.

use super::{
    recovery_codes::{self, RecoveryCodeHasher},
    totp::{TimeStep, Totp},
};
use crate::{
    common::{
        client::ClientInfo, email::SecurityNotice, encryption::EncryptionService, jwt::now_secs,
        lockout,
    },
    error::{AppError, AppResult},
    security_log::{SecurityEvent, SecurityEventKind},
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;
use validator::{Validate, ValidationError, ValidationErrors};

const TOTP_DIGITS: usize = 6;
/// Generous for a ten-symbol code typed with spaces or dashes.
const RECOVERY_CODE_MAX_CHARS: usize = 32;

/// What the user offers as their second factor, sent as `{ "code": "…" }` or
/// `{ "recoveryCode": "…" }`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum SecondFactorProof {
    Code(String),
    RecoveryCode(String),
}

impl SecondFactorProof {
    /// The factor as the security log names it.
    const fn factor(&self) -> &'static str {
        match self {
            Self::Code(_) => "authenticator_app",
            Self::RecoveryCode(_) => "recovery_code",
        }
    }
}

impl Validate for SecondFactorProof {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let (field, valid) = match self {
            Self::Code(code) => ("code", code.chars().count() == TOTP_DIGITS),
            Self::RecoveryCode(code) => (
                "recoveryCode",
                code.chars().count() <= RECOVERY_CODE_MAX_CHARS,
            ),
        };

        if valid {
            return Ok(());
        }

        let mut errors = ValidationErrors::new();
        errors.add(field, ValidationError::new("length"));
        Err(errors)
    }
}

/// The keys a second-factor check needs: the one TOTP secrets are encrypted
/// with and the one recovery codes are hashed with.
#[derive(Clone, Copy)]
pub struct SecondFactorKeys<'a> {
    pub encryption: &'a EncryptionService,
    pub recovery_codes: &'a RecoveryCodeHasher,
}

#[must_use]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeCheck {
    Accepted(Verified),
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verified {
    AuthenticatorApp,
    /// A recovery code was used up; the owner is told, with the count left.
    RecoveryCode {
        remaining: usize,
    },
}

impl Verified {
    /// What the account owner is told about this proof, if anything.
    pub fn security_notice(self) -> Option<SecurityNotice> {
        match self {
            Self::AuthenticatorApp => None,
            Self::RecoveryCode { remaining } => {
                Some(SecurityNotice::RecoveryCodeUsed { remaining })
            }
        }
    }
}

/// Verifies `proof` for the user's enabled second factor and records the
/// outcome. A locked factor fails with [`AppError::MfaLocked`] without the
/// proof being looked at, as does the miss that starts a lock; an account
/// without an enabled factor is `Rejected`.
pub async fn check(
    db: &PgPool,
    keys: SecondFactorKeys<'_>,
    user_id: Uuid,
    proof: &SecondFactorProof,
    client: &ClientInfo,
) -> AppResult<CodeCheck> {
    let mut tx = db.begin().await?;

    // The row lock serialises concurrent attempts, so parallel requests cannot
    // each see a counter below the limit, nor redeem one recovery code twice.
    let Some(user) = sqlx::query!(
        r#"SELECT email, mfa_secret AS "mfa_secret!", mfa_failed_attempts,
                  mfa_locked_until, mfa_last_used_step
           FROM users
           WHERE id = $1 AND mfa_enabled AND mfa_secret IS NOT NULL
           FOR UPDATE"#,
        user_id
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(CodeCheck::Rejected);
    };

    let now = Utc::now();
    let counter = lockout::Counter {
        misses: user.mfa_failed_attempts,
        locked_until: user.mfa_locked_until,
    };
    if let Some(retry_after) = counter.locked_for(now) {
        return Err(AppError::MfaLocked { retry_after });
    }

    let verified = match proof {
        SecondFactorProof::Code(code) => {
            let totp =
                Totp::from_stored(keys.encryption, user.mfa_secret, user_id, &user.email).await?;
            let last_used = user.mfa_last_used_step.map(TimeStep::from_db);
            totp.matching_step(code, now_secs())
                .filter(|&step| last_used.is_none_or(|last| step > last))
                .map(|step| (Verified::AuthenticatorApp, Some(step)))
        }
        SecondFactorProof::RecoveryCode(code) => {
            recovery_codes::redeem(&mut tx, keys.recovery_codes, user_id, code)
                .await?
                .map(|remaining| (Verified::RecoveryCode { remaining }, None))
        }
    };

    let Some((verified, step)) = verified else {
        let counter = counter.after_miss(now);
        let lock = counter.locked_for(now);

        sqlx::query!(
            r#"UPDATE users SET mfa_failed_attempts = $2, mfa_locked_until = $3 WHERE id = $1"#,
            user_id,
            counter.misses,
            counter.locked_until
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::SecondFactorFailed)
            .user(user_id)
            .client(client)
            .metadata(json!({ "factor": proof.factor() }))
            .record(&mut *tx)
            .await?;

        if let Some(lock) = lock {
            SecurityEvent::new(SecurityEventKind::SecondFactorLocked)
                .user(user_id)
                .client(client)
                .metadata(lockout::describe(counter.misses, lock))
                .record(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        // The miss that starts a lock already says so, rather than leaving the
        // user to find out with their next code.
        return match lock {
            Some(retry_after) => Err(AppError::MfaLocked { retry_after }),
            None => Ok(CodeCheck::Rejected),
        };
    };

    // A recovery code leaves the last used step alone: the authenticator's
    // codes stay single-use either way.
    sqlx::query!(
        r#"UPDATE users
           SET mfa_failed_attempts = 0, mfa_locked_until = NULL,
               mfa_last_used_step = COALESCE($2, mfa_last_used_step)
           WHERE id = $1"#,
        user_id,
        step.map(TimeStep::as_db)
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(CodeCheck::Accepted(verified))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(json: &str) -> SecondFactorProof {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn proofs_are_told_apart_by_their_key() {
        assert!(matches!(
            parse(r#"{"code":"123456"}"#),
            SecondFactorProof::Code(_)
        ));
        assert!(matches!(
            parse(r#"{"recoveryCode":"ABCDE-FGHJK"}"#),
            SecondFactorProof::RecoveryCode(_)
        ));
        assert!(serde_json::from_str::<SecondFactorProof>(r#"{"other":"x"}"#).is_err());
    }

    #[test]
    fn authenticator_codes_must_have_six_symbols() {
        assert!(parse(r#"{"code":"123456"}"#).validate().is_ok());
        assert!(parse(r#"{"code":"12345"}"#).validate().is_err());
        assert!(parse(r#"{"code":"1234567"}"#).validate().is_err());
    }

    #[test]
    fn recovery_codes_are_bounded_in_length() {
        assert!(
            parse(r#"{"recoveryCode":"ABCDE-FGHJK"}"#)
                .validate()
                .is_ok()
        );
        let long = format!(r#"{{"recoveryCode":"{}"}}"#, "A".repeat(33));
        assert!(parse(&long).validate().is_err());
    }
}
