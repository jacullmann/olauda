use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    // A separate bucket from the password routes, so mistyped 2FA codes do not
    // eat into the login budget of everyone sharing an IP (e.g. a school NAT).
    let mfa = OpenApiRouter::new()
        .routes(routes!(verify_mfa))
        .routes(routes!(start_mfa_passkey))
        .routes(routes!(verify_mfa_passkey))
        .layer(rate_limit::per_client(20, Duration::from_secs(1)));

    // Kept apart from the password routes, so mistyped codes and passwords do
    // not use up a client's email budget, and the stricter email budget does
    // not hold up sign-ins.
    let outgoing_mail = OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(resend_verification))
        .routes(routes!(forgot_password))
        .layer(rate_limit::outgoing_mail());

    let sensitive = OpenApiRouter::new()
        .routes(routes!(login))
        .routes(routes!(confirm_sign_up))
        .routes(routes!(verify_reset_token))
        .routes(routes!(reset_password))
        .routes(routes!(request_password_setup_code))
        .routes(routes!(set_password))
        .layer(rate_limit::per_client(30, Duration::from_secs(3)));

    let normal = OpenApiRouter::new()
        .routes(routes!(get_mfa_challenge))
        .routes(routes!(cancel_mfa))
        .routes(routes!(get_me, delete_me))
        .routes(routes!(change_password))
        .routes(routes!(remove_password))
        .routes(routes!(get_sign_in_methods))
        .routes(routes!(refresh))
        .routes(routes!(logout))
        .routes(routes!(logout_all))
        .routes(routes!(logout_all_others))
        .routes(routes!(list_sessions))
        .routes(routes!(revoke_session));

    OpenApiRouter::new()
        .merge(mfa)
        .merge(outgoing_mail)
        .merge(sensitive)
        .merge(normal)
}
