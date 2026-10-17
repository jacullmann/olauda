use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    // Each export reads every table holding the user's data; the limit keeps
    // repeated clicks from turning that into load.
    OpenApiRouter::new()
        .routes(routes!(export_data))
        .layer(rate_limit::per_client(10, Duration::from_secs(30)))
}
