use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    // A Google sign-in takes two requests (start and callback) per person.
    let sensitive = OpenApiRouter::new()
        .routes(routes!(initiate_google_oauth))
        .routes(routes!(sign_up_with_google))
        .routes(routes!(handle_google_callback))
        .routes(routes!(start_google_link))
        .layer(rate_limit::per_client(60, Duration::from_millis(500)));

    let normal = OpenApiRouter::new()
        .routes(routes!(unlink_google_account))
        .routes(routes!(get_linked_providers));

    OpenApiRouter::new().merge(sensitive).merge(normal)
}
