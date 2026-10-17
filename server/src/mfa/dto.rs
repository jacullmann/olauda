use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MfaCodeDto {
    #[validate(length(equal = 6))]
    pub code: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MfaStatusDto {
    pub mfa_enabled: bool,
    /// Only while two-factor authentication is on.
    pub recovery_codes_left: Option<usize>,
}

/// A new authenticator secret, valid until confirmed with a code from it.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MfaSetupDto {
    pub otpauth_url: String,
    /// Base32, for typing into an authenticator app by hand.
    pub secret: String,
    pub expires_at: DateTime<Utc>,
}

/// Shown this once; only their hashes are stored.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCodesDto {
    pub recovery_codes: Vec<String>,
}
