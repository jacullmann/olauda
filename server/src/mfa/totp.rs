//! Time-based one-time passwords (RFC 6238) as authenticator apps generate
//! them: six digits from an HMAC-SHA1 over 30-second time steps.

use crate::{
    common::encryption::{EncryptedPayload, EncryptionService},
    error::{AppError, AppResult},
};
use subtle::ConstantTimeEq;
use totp_rs::{Algorithm, TOTP};
use uuid::Uuid;

const DIGITS: usize = 6;
const STEP_SECS: u64 = 30;
/// One step either side of the current one, so a code typed just as it rolls
/// over, or on a device whose clock drifts a little, still counts.
const SKEW_STEPS: u64 = 1;
const ISSUER: &str = "Olauda";
const SECRET_BYTES: usize = 20;
const BASE32: base32::Alphabet = base32::Alphabet::Rfc4648 { padding: false };

/// The 30-second window a code was generated for. Accepting each step only
/// once makes every code single-use.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct TimeStep(i64);

impl TimeStep {
    pub fn from_db(step: i64) -> Self {
        Self(step)
    }

    pub fn as_db(self) -> i64 {
        self.0
    }
}

pub struct Totp(TOTP);

impl Totp {
    /// A fresh secret for a new authenticator, in the base32 form apps accept.
    pub fn generate_secret() -> String {
        base32::encode(BASE32, &rand::random::<[u8; SECRET_BYTES]>())
    }

    /// `account` labels the entry in the authenticator app.
    pub fn from_base32(secret: &str, account: &str) -> AppResult<Self> {
        let bytes = base32::decode(BASE32, secret)
            .ok_or_else(|| AppError::internal("Invalid TOTP secret encoding"))?;

        TOTP::new(
            Algorithm::SHA1,
            DIGITS,
            SKEW_STEPS as u8,
            STEP_SECS,
            bytes,
            Some(ISSUER.to_owned()),
            account.to_owned(),
        )
        .map(Self)
        .map_err(|e| AppError::internal(format!("TOTP init failed: {e}")))
    }

    /// Secrets are stored encrypted with the key of the user they belong to.
    pub async fn from_stored(
        enc: &EncryptionService,
        stored: serde_json::Value,
        user_id: Uuid,
        account: &str,
    ) -> AppResult<Self> {
        let payload: EncryptedPayload = serde_json::from_value(stored)
            .map_err(|_| AppError::internal("Invalid encrypted TOTP secret"))?;
        let secret = enc.decrypt(&payload, &user_id.to_string()).await?;

        Self::from_base32(&secret, account)
    }

    pub fn otpauth_url(&self) -> String {
        self.0.get_url()
    }

    /// The step `code` was generated for, if it is valid at `unix_secs`.
    /// Every candidate step is compared in constant time, so the response
    /// time reveals neither whether nor which one matched.
    pub fn matching_step(&self, code: &str, unix_secs: u64) -> Option<TimeStep> {
        let current = unix_secs / STEP_SECS;
        let candidates = current.saturating_sub(SKEW_STEPS)..=current + SKEW_STEPS;

        // A fold rather than `find`, so every candidate is generated and
        // compared even after a match.
        candidates
            .fold(None, |matched, step| {
                let expected = self.0.generate(step * STEP_SECS);
                let is_match: bool = expected.as_bytes().ct_eq(code.as_bytes()).into();
                if is_match { Some(step) } else { matched }
            })
            .and_then(|step| i64::try_from(step).ok())
            .map(TimeStep)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 1_800_000_000;

    fn totp() -> Totp {
        Totp::from_base32(&Totp::generate_secret(), "user@example.com").unwrap()
    }

    fn code_at(totp: &Totp, unix_secs: u64) -> String {
        totp.0.generate(unix_secs)
    }

    #[test]
    fn current_code_matches_the_current_step() {
        let totp = totp();
        let step = totp.matching_step(&code_at(&totp, NOW), NOW).unwrap();
        assert_eq!(step.as_db(), (NOW / STEP_SECS) as i64);
    }

    #[test]
    fn neighbouring_steps_are_accepted_and_reported_as_such() {
        let totp = totp();
        let previous = totp
            .matching_step(&code_at(&totp, NOW - STEP_SECS), NOW)
            .unwrap();
        let next = totp
            .matching_step(&code_at(&totp, NOW + STEP_SECS), NOW)
            .unwrap();

        assert_eq!(previous.as_db() + 1, (NOW / STEP_SECS) as i64);
        assert_eq!(next.as_db() - 1, (NOW / STEP_SECS) as i64);
    }

    #[test]
    fn codes_outside_the_skew_are_rejected() {
        let totp = totp();
        assert!(
            totp.matching_step(&code_at(&totp, NOW - 2 * STEP_SECS), NOW)
                .is_none()
        );
        assert!(
            totp.matching_step(&code_at(&totp, NOW + 2 * STEP_SECS), NOW)
                .is_none()
        );
    }

    #[test]
    fn malformed_codes_are_rejected() {
        let totp = totp();
        for code in ["", "12345", "1234567", "abcdef"] {
            assert!(totp.matching_step(code, NOW).is_none(), "accepted {code:?}");
        }
    }
}
