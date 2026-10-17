use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    // The login page asks for a challenge as soon as it opens, so the burst
    // covers a class opening it together. A signature cannot be guessed; the
    // limit only stops floods of stored challenges.
    let sign_in = OpenApiRouter::new()
        .routes(routes!(start_sign_in))
        .routes(routes!(finish_sign_in))
        .layer(rate_limit::per_client(60, Duration::from_secs(1)));

    let registration = OpenApiRouter::new()
        .routes(routes!(start_registration))
        .routes(routes!(finish_registration))
        .layer(rate_limit::per_client(10, Duration::from_secs(2)));

    let normal = OpenApiRouter::new()
        .routes(routes!(list_passkeys))
        .routes(routes!(rename_passkey, remove_passkey));

    OpenApiRouter::new()
        .merge(sign_in)
        .merge(registration)
        .merge(normal)
}
