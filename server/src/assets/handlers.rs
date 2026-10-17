use super::{
    dto::{GroupAvatarUploadDto, UploadDto, UploadForm},
    file_kind::{MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES},
    service::{AssetService, ReceivedFile},
};
use crate::{
    common::{
        extractors::{AuthUser, TenantContext},
        permission::Permission,
    },
    error::AppResult,
    require_permission,
    state::AppState,
};
use axum::{
    Json,
    extract::{Multipart, State},
    http::StatusCode,
};

/// Stores a file for a task; it is attached by sending its id along with the
/// task or to the task's attachments.
#[utoipa::path(
    post,
    path = "/items/uploads",
    tag = "uploads",
    request_body(content = UploadForm, content_type = "multipart/form-data"),
    responses((status = 201, body = UploadDto)),
)]
pub async fn upload_attachment(
    State(s): State<AppState>,
    tc: TenantContext,
    multipart: Multipart,
) -> AppResult<(StatusCode, Json<UploadDto>)> {
    require_permission!(tc, Permission::UploadImages);
    let file = ReceivedFile::read(multipart, MAX_DOCUMENT_BYTES).await?;

    let upload = AssetService::from_state(&s)
        .upload_attachment(tc.user.user_id, file)
        .await?;

    Ok((StatusCode::CREATED, Json(upload)))
}

/// A new group's picture is uploaded before the group exists, so this is the
/// one upload that needs no group membership.
#[utoipa::path(
    post,
    path = "/uploads/group-avatar",
    tag = "uploads",
    request_body(content = UploadForm, content_type = "multipart/form-data"),
    responses((status = 201, body = GroupAvatarUploadDto)),
)]
pub async fn upload_group_avatar(
    State(s): State<AppState>,
    user: AuthUser,
    multipart: Multipart,
) -> AppResult<(StatusCode, Json<GroupAvatarUploadDto>)> {
    let file = ReceivedFile::read(multipart, MAX_IMAGE_BYTES).await?;

    let upload = AssetService::from_state(&s)
        .upload_group_avatar(user.user_id, file)
        .await?;

    Ok((StatusCode::CREATED, Json(upload)))
}
