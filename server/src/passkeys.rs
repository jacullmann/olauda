pub mod dto;
pub mod handlers;
pub mod routes;
pub mod service;

use crate::config::{PASSKEY_CEREMONY_TTL, WebauthnConfig};
use anyhow::anyhow;
use webauthn_rs::{Webauthn, WebauthnBuilder};

/// Shown by the browser and the passkey manager next to the account name.
const RP_NAME: &str = "Olauda";

pub fn relying_party(config: &WebauthnConfig) -> anyhow::Result<Webauthn> {
    WebauthnBuilder::new(&config.rp_id, &config.rp_origin)
        .and_then(|builder| {
            builder
                .rp_name(RP_NAME)
                .timeout(PASSKEY_CEREMONY_TTL)
                .build()
        })
        .map_err(|e| {
            anyhow!(
                "rp_id {} does not match origin {}: {e}",
                config.rp_id,
                config.rp_origin
            )
        })
}
