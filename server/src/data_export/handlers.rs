use super::{archive, dto::DataArchive, service::DataExportService};
use crate::{
    common::{client::ClientInfo, extractors::RecentAuth},
    error::AppResult,
    state::AppState,
};
use axum::{
    extract::State,
    http::header::{CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_TYPE},
    response::IntoResponse,
};

/// A ZIP of everything stored about the account. It needs a recent sign-in,
/// as a stolen session must not be enough to take it.
#[utoipa::path(
    get,
    path = "/user/data-export",
    tag = "user",
    responses((
        status = 200,
        description = "The archive",
        content_type = "application/zip",
        body = DataArchive,
    )),
)]
pub async fn export_data(
    State(s): State<AppState>,
    RecentAuth(user): RecentAuth,
    client: ClientInfo,
) -> AppResult<impl IntoResponse> {
    let svc = DataExportService::from_state(&s);

    let export = svc.collect(user.user_id).await?;
    let file_name = archive::file_name(export.exported_at);
    let bytes = archive::build(export).await?;

    svc.log_export(user.user_id, &client).await?;

    Ok((
        [
            (CONTENT_TYPE, "application/zip".to_owned()),
            (
                CONTENT_DISPOSITION,
                format!("attachment; filename=\"{file_name}\""),
            ),
            (CACHE_CONTROL, "no-store".to_owned()),
        ],
        bytes,
    ))
}
