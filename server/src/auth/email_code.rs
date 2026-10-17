//! One-time codes that prove control of an account's email address. A
//! password reset and the first password of a Google-only account both redeem
//! them, as both grant the same thing: a password for that address. Sign-ups
//! are confirmed with the same kind of code (see
//! [`email_verification`](super::email_verification)).
//!
//! A code is short enough to type, so it is guarded per address rather than
//! per network, which an attacker can switch at will: every code allows only a
//! few guesses, and an address receives only a few codes. That second bound
//! also keeps strangers from flooding someone's inbox through us.

use crate::{
    common::send_limit::{MAIL_LIMITS, longest_window, retry_after},
    config::{PASSWORD_RESET_CODE_TTL, chrono_ttl},
    error::{AppError, AppResult},
};
use chrono::{TimeDelta, Utc};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::{PgConnection, PgPool};
use std::fmt;

/// With ten codes a day under [`MAIL_LIMITS`], an attacker gets 50 guesses a
/// day at one of a million codes. `cleanup_expired_password_resets()`
/// (migration 0050) keeps issued codes for the longest window, so it can be
/// counted.
pub const MAX_ATTEMPTS_PER_CODE: i32 = 5;

/// A code as we mail it: six digits, quick to read off a phone and type on
/// another device. Anything else is rejected before it can cost a guess.
#[derive(Clone, PartialEq, Eq, Deserialize, utoipa::ToSchema)]
#[serde(try_from = "String")]
#[schema(pattern = "^[0-9]{6}$")]
pub struct EmailCode(String);

impl EmailCode {
    const LENGTH: usize = 6;

    pub fn generate() -> Self {
        Self(format!("{:06}", rand::random_range(0..1_000_000)))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Comparing digests takes the same time wherever the inputs first differ.
    pub fn matches(&self, stored: &str) -> bool {
        Sha256::digest(self.0.as_bytes()) == Sha256::digest(stored.as_bytes())
    }
}

impl TryFrom<String> for EmailCode {
    type Error = &'static str;

    fn try_from(code: String) -> Result<Self, Self::Error> {
        if code.len() == Self::LENGTH && code.bytes().all(|b| b.is_ascii_digit()) {
            Ok(Self(code))
        } else {
            Err("a code consists of six digits")
        }
    }
}

/// Codes are secrets, so they never reach a log.
impl fmt::Debug for EmailCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("EmailCode(..)")
    }
}

#[must_use]
pub enum Issuance {
    Issued(EmailCode),
    /// The address received as many codes as it may for now. Nothing was
    /// stored or sent, so the code it got last stays valid.
    Throttled {
        retry_after: TimeDelta,
    },
}

/// Issues a new code for `email`, replacing the previous one, unless the
/// address is at its limit.
pub async fn issue(db: &PgPool, email: &str) -> AppResult<Issuance> {
    let mut tx = db.begin().await?;

    lock_address(&mut tx, email).await?;

    let now = Utc::now();
    let issued_newest_first = sqlx::query_scalar!(
        r#"SELECT created_at FROM password_resets
           WHERE email = $1 AND created_at > $2
           ORDER BY created_at DESC"#,
        email,
        now - longest_window(&MAIL_LIMITS)
    )
    .fetch_all(&mut *tx)
    .await?;

    if let Some(retry_after) = retry_after(&MAIL_LIMITS, &issued_newest_first, now) {
        tx.rollback().await?;
        return Ok(Issuance::Throttled { retry_after });
    }

    sqlx::query!(
        r#"UPDATE password_resets SET used = true WHERE email = $1 AND used = false"#,
        email
    )
    .execute(&mut *tx)
    .await?;

    let code = EmailCode::generate();

    // The same clock as the limit check, so a code counts exactly as long as
    // its windows say.
    sqlx::query!(
        r#"INSERT INTO password_resets (email, code, expires_at, created_at)
           VALUES ($1, $2, $3, $4)"#,
        email,
        code.as_str(),
        now + chrono_ttl(PASSWORD_RESET_CODE_TTL),
        now
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Issuance::Issued(code))
}

/// Checks `code` against the latest code of `email` and uses it up on a match.
pub async fn redeem(db: &PgPool, email: &str, code: &EmailCode) -> AppResult<()> {
    let mut tx = db.begin().await?;

    let pr = sqlx::query!(
        r#"
        UPDATE password_resets SET attempts = attempts + 1
        WHERE id = (
            SELECT id FROM password_resets
            WHERE email = $1 AND used = false
            ORDER BY created_at DESC LIMIT 1
        )
        RETURNING id, code, expires_at, attempts
        "#,
        email
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Invalid code.".into()))?;

    if pr.attempts > MAX_ATTEMPTS_PER_CODE {
        sqlx::query!(
            r#"UPDATE password_resets SET used = true WHERE id = $1"#,
            pr.id
        )
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Err(AppError::BadRequest(
            "Too many attempts. Please request a new code.".into(),
        ));
    }

    if pr.expires_at < Utc::now() {
        tx.commit().await?;
        return Err(AppError::BadRequest("Code has expired.".into()));
    }

    if !code.matches(&pr.code) {
        tx.commit().await?;
        return Err(AppError::BadRequest("Invalid code.".into()));
    }

    sqlx::query!(
        r#"UPDATE password_resets SET used = true WHERE id = $1"#,
        pr.id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Serialises everything that mails `email` until the transaction ends, so
/// concurrent requests cannot all pass a send limit, nor race each other to
/// create the same account.
pub async fn lock_address(conn: &mut PgConnection, email: &str) -> AppResult<()> {
    sqlx::query!(
        "SELECT FROM pg_advisory_xact_lock(hashtextextended($1, 0))",
        email
    )
    .execute(conn)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(code: &str) -> Result<EmailCode, &'static str> {
        EmailCode::try_from(code.to_owned())
    }

    #[test]
    fn generated_codes_are_six_digits() {
        for _ in 0..1_000 {
            let code = EmailCode::generate();
            assert_eq!(parse(code.as_str()), Ok(code));
        }
    }

    #[test]
    fn only_six_digits_are_a_code() {
        assert!(parse("012345").is_ok());
        for malformed in ["", "12345", "1234567", "12345a", "A1B2C3", " 12345"] {
            assert!(parse(malformed).is_err(), "{malformed:?} was accepted");
        }
    }

    #[test]
    fn a_code_matches_only_itself() {
        let code = parse("012345").unwrap();
        assert!(code.matches("012345"));
        assert!(!code.matches("012346"));
        assert!(!code.matches("12345"));
    }
}
