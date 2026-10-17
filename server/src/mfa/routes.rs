use super::handlers::*;
use crate::{common::rate_limit, state::AppState};
use std::time::Duration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    let sensitive = OpenApiRouter::new()
        .routes(routes!(activate))
        .routes(routes!(deactivate))
        .routes(routes!(regenerate_recovery_codes))
        .layer(rate_limit::per_client(10, Duration::from_secs(2)));

    let normal = OpenApiRouter::new()
        .routes(routes!(get_mfa_status))
        .routes(routes!(setup));

    OpenApiRouter::new().merge(sensitive).merge(normal)
}
