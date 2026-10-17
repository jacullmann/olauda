use super::{
    attachments::AttachmentDto,
    dto::*,
    policy::ItemActor,
    service::{GetItemsFilter, ItemsService},
};
use crate::{
    common::{
        created::CreatedDto,
        extractors::{TenantContext, ValidatedJson},
        path_params::{IdPath, ItemAttachmentPath},
        permission::Permission,
        text::DisplayText,
    },
    error::AppResult,
    reports::service::{REASON_MAX_CHARS, ReportsService},
    require_permission,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};

/// The group's tasks for the given filters, ordered by due date.
#[utoipa::path(
    get,
    path = "/items",
    tag = "items",
    params(ItemsQuery),
    responses((status = 200, body = ItemListDto)),
)]
pub async fn get_items(
    State(s): State<AppState>,
    tc: TenantContext,
    Query(q): Query<ItemsQuery>,
) -> AppResult<Json<ItemListDto>> {
    let list = ItemsService::from_state(&s)
        .get_items(
            tc.tenant_id,
            tc.user.user_id,
            GetItemsFilter {
                item_type: q.r#type,
                archived: q.archived,
                subject_id: q.subject_id,
                hide_checked: q.hide_checked,
                personalized: q.personalized,
            },
            tc.is_superadmin,
        )
        .await?;

    Ok(Json(list))
}

#[utoipa::path(
    get,
    path = "/items/{id}",
    tag = "items",
    params(IdPath),
    responses((status = 200, body = ItemDto)),
)]
pub async fn get_item_by_id(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<Json<ItemDto>> {
    Ok(Json(
        ItemsService::from_state(&s)
            .get_item_by_id(tc.tenant_id, tc.user.user_id, id, tc.is_superadmin)
            .await?,
    ))
}

/// Refused with `DUPLICATE_ITEM` while a task of the same type, subject and
/// day exists, unless `confirmDuplicate` is set.
#[utoipa::path(
    post,
    path = "/items",
    tag = "items",
    request_body = CreateItemDto,
    responses((status = 201, body = CreatedDto)),
)]
pub async fn create_item(
    State(s): State<AppState>,
    tc: TenantContext,
    ValidatedJson(dto): ValidatedJson<CreateItemDto>,
) -> AppResult<(StatusCode, Json<CreatedDto>)> {
    require_permission!(tc, Permission::CreateItems);

    let id = ItemsService::from_state(&s)
        .create_item(tc.tenant_id, ItemActor::from_context(&tc)?, &dto)
        .await?;

    Ok((StatusCode::CREATED, Json(CreatedDto { id })))
}

#[utoipa::path(
    patch,
    path = "/items/{id}",
    tag = "items",
    params(IdPath),
    request_body = UpdateItemDto,
    responses((status = 204)),
)]
pub async fn update_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    ValidatedJson(dto): ValidatedJson<UpdateItemDto>,
) -> AppResult<StatusCode> {
    ItemsService::from_state(&s)
        .update_item(tc.tenant_id, id, ItemActor::from_context(&tc)?, &dto)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/items/{id}",
    tag = "items",
    params(IdPath),
    responses((status = 204)),
)]
pub async fn delete_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
) -> AppResult<StatusCode> {
    ItemsService::from_state(&s)
        .delete_item(tc.tenant_id, id, ItemActor::from_context(&tc)?)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    patch,
    path = "/items/{id}/note",
    tag = "items",
    params(IdPath),
    request_body = UpdateEditorNoteDto,
    responses((status = 200, body = EditorNoteDto)),
)]
pub async fn update_item_note(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<UpdateEditorNoteDto>,
) -> AppResult<Json<EditorNoteDto>> {
    require_permission!(tc, Permission::ManageNotes);
    let note = DisplayText::parse_optional(Some(&dto.editor_note), NOTE_MAX_CHARS, "editorNote")?;

    let editor_note = ItemsService::from_state(&s)
        .update_item_note(tc.tenant_id, id, tc.user.user_id, note.as_ref())
        .await?;

    Ok(Json(EditorNoteDto { editor_note }))
}

#[utoipa::path(
    post,
    path = "/items/{id}/attachments",
    tag = "items",
    params(IdPath),
    request_body = AddAttachmentDto,
    responses((status = 201, body = AttachmentDto)),
)]
pub async fn add_attachment(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(IdPath { id }): Path<IdPath>,
    Json(dto): Json<AddAttachmentDto>,
) -> AppResult<(StatusCode, Json<AttachmentDto>)> {
    require_permission!(tc, Permission::UploadImages);

    let attachment = ItemsService::from_state(&s)
        .add_attachment(tc.tenant_id, id, tc.user.user_id, dto.asset_id)
        .await?;

    Ok((StatusCode::CREATED, Json(attachment)))
}

#[utoipa::path(
    delete,
    path = "/items/{id}/attachments/{attachment_id}",
    tag = "items",
    params(ItemAttachmentPath),
    responses((status = 204)),
)]
pub async fn remove_attachment(
    State(s): State<AppState>,
    tc: TenantContext,
    Path(ItemAttachmentPath { id, attachment_id }): Path<ItemAttachmentPath>,
) -> AppResult<StatusCode> {
    ItemsService::from_state(&s)
        .remove_attachment(
            tc.tenant_id,
            id,
            ItemActor::from_context(&tc)?,
            attachment_id,
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/items/reports",
    tag = "items",
    request_body = ReportItemDto,
    responses((status = 204)),
)]
pub async fn report_item(
    State(s): State<AppState>,
    tc: TenantContext,
    Json(dto): Json<ReportItemDto>,
) -> AppResult<StatusCode> {
    let reason = DisplayText::parse_optional(dto.reason.as_deref(), REASON_MAX_CHARS, "reason")?;

    ReportsService::from_state(&s)
        .report_task(
            tc.tenant_id,
            tc.user.user_id,
            &tc.user.email,
            dto.item_id,
            reason.as_ref(),
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
