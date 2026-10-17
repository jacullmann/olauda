use super::{
    dto::{AdminSystemAnnouncementDto, SaveSystemAnnouncementDto, SystemAnnouncementDto},
    service::SystemAnnouncementService,
};
use crate::{
    announcements::dto::MarkAnnouncementsReadDto,
    common::{
        client::ClientInfo,
        created::CreatedDto,
        extractors::{AuthUser, SuperAdmin, ValidatedJson},
    },
    error::AppResult,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use uuid::Uuid;

/// The running announcements the user has yet to read, newest first.
#[utoipa::path(
    get,
    path = "/system-announcements",
    tag = "system",
    responses((status = 200, body = Vec<SystemAnnouncementDto>)),
)]
pub async fn list_system_announcements(
    State(s): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<Vec<SystemAnnouncementDto>>> {
    Ok(Json(
        SystemAnnouncementService::from_state(&s)
            .list_unread(user.user_id)
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/system-announcements/read",
    tag = "system",
    request_body = MarkAnnouncementsReadDto,
    responses((status = 204)),
)]
pub async fn mark_system_announcements_read(
    State(s): State<AppState>,
    user: AuthUser,
    ValidatedJson(dto): ValidatedJson<MarkAnnouncementsReadDto>,
) -> AppResult<StatusCode> {
    SystemAnnouncementService::from_state(&s)
        .mark_read(user.user_id, &dto.ids)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Running and scheduled announcements, latest start first.
#[utoipa::path(
    get,
    path = "/admin/system-announcements",
    tag = "admin",
    responses((status = 200, body = Vec<AdminSystemAnnouncementDto>)),
)]
pub async fn list_admin_system_announcements(
    State(s): State<AppState>,
    _: SuperAdmin,
) -> AppResult<Json<Vec<AdminSystemAnnouncementDto>>> {
    Ok(Json(
        SystemAnnouncementService::from_state(&s)
            .list_for_admin()
            .await?,
    ))
}

#[utoipa::path(
    post,
    path = "/admin/system-announcements",
    tag = "admin",
    request_body = SaveSystemAnnouncementDto,
    responses((status = 201, body = CreatedDto)),
)]
pub async fn create_system_announcement(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Json(dto): Json<SaveSystemAnnouncementDto>,
) -> AppResult<(StatusCode, Json<CreatedDto>)> {
    let input = dto.parse(Utc::now())?;

    let id = SystemAnnouncementService::from_state(&s)
        .create(&input, admin.user_id, &client)
        .await?;

    Ok((StatusCode::CREATED, Json(CreatedDto { id })))
}

/// Only scheduled announcements can be changed.
#[utoipa::path(
    put,
    path = "/admin/system-announcements/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    request_body = SaveSystemAnnouncementDto,
    responses((status = 204)),
)]
pub async fn update_system_announcement(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
    Json(dto): Json<SaveSystemAnnouncementDto>,
) -> AppResult<StatusCode> {
    let input = dto.parse(Utc::now())?;

    SystemAnnouncementService::from_state(&s)
        .update(id, &input, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/admin/system-announcements/{id}",
    tag = "admin",
    params(("id" = Uuid, Path)),
    responses((status = 204)),
)]
pub async fn delete_system_announcement(
    State(s): State<AppState>,
    SuperAdmin(admin): SuperAdmin,
    client: ClientInfo,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    SystemAnnouncementService::from_state(&s)
        .delete(id, admin.user_id, &client)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
