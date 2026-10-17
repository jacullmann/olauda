use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    // Shares the pace of the password sign-in; the per-account lock bounds
    // guessing by anyone who holds a session.
    let confirm = OpenApiRouter::new()
        .routes(routes!(confirm_with_password))
        .routes(routes!(start_passkey))
        .routes(routes!(confirm_with_passkey))
        .routes(routes!(start_google))
        .routes(routes!(confirm_google_second_factor))
        .layer(rate_limit::per_client(30, Duration::from_secs(3)));

    OpenApiRouter::new()
        .routes(routes!(get_reauth_status))
        .merge(confirm)
}
