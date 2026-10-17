use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;
use webauthn_rs::prelude::{PublicKeyCredential, RegisterPublicKeyCredential};
use webauthn_rs_proto::{PublicKeyCredentialCreationOptions, PublicKeyCredentialRequestOptions};

// The WebAuthn structures are the browser's own JSON forms. They are left
// untyped here and typed in the client by the WebAuthn library that hands
// them to the browser.

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FinishRegistrationDto {
    pub name: String,
    #[schema(value_type = Value)]
    pub credential: RegisterPublicKeyCredential,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenamePasskeyDto {
    pub name: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignInDto {
    pub challenge_id: Uuid,
    #[schema(value_type = Value)]
    pub credential: PublicKeyCredential,
}

/// A started passkey check: the options for the browser and the id to finish
/// it with.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyChallengeDto {
    pub challenge_id: Uuid,
    #[schema(value_type = Value)]
    pub options: PublicKeyCredentialRequestOptions,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationDto {
    #[schema(value_type = Value)]
    pub options: PublicKeyCredentialCreationOptions,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasskeySummary {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    /// Base64url, as the browser reports it, so the client can tell the
    /// passkey manager which credentials still exist.
    pub credential_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyList {
    pub passkeys: Vec<PasskeySummary>,
    pub rp_id: String,
    /// The user handle the passkeys carry, base64url-encoded.
    pub user_handle: String,
}
