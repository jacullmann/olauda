use super::{
    file_kind::{MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES},
    handlers::*,
};
use crate::{common::rate_limit, state::AppState};
use axum::extract::DefaultBodyLimit;
use tower::ServiceBuilder;
use utoipa_axum::{
    router::{OpenApiRouter, UtoipaMethodRouterExt},
    routes,
};

/// Room for the multipart framing around the file itself.
const MULTIPART_OVERHEAD_BYTES: usize = 64 * 1024;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(
        routes!(upload_group_avatar).layer(
            ServiceBuilder::new()
                .layer(rate_limit::uploads())
                .layer(DefaultBodyLimit::max(
                    MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES,
                )),
        ),
    )
}

/// Mounted under `/groups/{group_id}` behind the tenant middleware.
pub fn group_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(
        routes!(upload_attachment).layer(ServiceBuilder::new().layer(rate_limit::uploads()).layer(
            DefaultBodyLimit::max(MAX_DOCUMENT_BYTES + MULTIPART_OVERHEAD_BYTES),
        )),
    )
}
