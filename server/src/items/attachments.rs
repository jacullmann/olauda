//! Files attached to tasks. An attachment links a task to an upload the
//! attaching member made themselves; the file's facts come from the `assets`
//! row the server wrote when it verified the upload.

use crate::{
    assets::{
        dto::FileDto,
        service::{AssetPurpose, CLAIM_WINDOW_HOURS, invalid_upload},
    },
    common::cloudinary::ResourceType,
    error::{AppError, AppResult},
};
use serde::Serialize;
use sqlx::{PgConnection, PgExecutor};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentDto {
    pub id: Uuid,
    /// Recorded by the server; lets the uploader remove their file again from
    /// a task they do not own.
    pub created_by: Option<Uuid>,
    #[serde(flatten)]
    pub file: FileDto,
}

/// How many attachments a task holds, in total and from one member.
pub struct AttachmentCount {
    pub total: usize,
    pub own: usize,
}

/// The attachments of `item_ids`, in the order they were added.
pub async fn of_items<'e>(
    db: impl PgExecutor<'e>,
    item_ids: &[Uuid],
) -> AppResult<HashMap<Uuid, Vec<AttachmentDto>>> {
    let rows = sqlx::query!(
        r#"SELECT at.item_id, at.id, at.created_by,
                  a.public_id, a.resource_type AS "resource_type: ResourceType", a.format,
                  a.width, a.height, a.original_name,
                  thumbnail.public_id AS "thumbnail_public_id?"
           FROM item_attachments at
           JOIN assets a ON a.id = at.asset_id
           LEFT JOIN assets thumbnail ON thumbnail.id = a.thumbnail_id
           WHERE at.item_id = ANY($1)
           ORDER BY at.created_at, at.id"#,
        item_ids
    )
    .fetch_all(db)
    .await?;

    let mut by_item: HashMap<Uuid, Vec<AttachmentDto>> = HashMap::new();
    for row in rows {
        by_item.entry(row.item_id).or_default().push(AttachmentDto {
            id: row.id,
            created_by: row.created_by,
            file: FileDto {
                public_id: row.public_id,
                resource_type: row.resource_type,
                format: row.format,
                width: row.width,
                height: row.height,
                name: row.original_name,
                thumbnail_public_id: row.thumbnail_public_id,
            },
        });
    }

    Ok(by_item)
}

pub async fn of_item<'e>(db: impl PgExecutor<'e>, item_id: Uuid) -> AppResult<Vec<AttachmentDto>> {
    Ok(of_items(db, &[item_id])
        .await?
        .remove(&item_id)
        .unwrap_or_default())
}

pub async fn count<'e>(
    db: impl PgExecutor<'e>,
    item_id: Uuid,
    member: Uuid,
) -> AppResult<AttachmentCount> {
    let row = sqlx::query!(
        r#"SELECT COUNT(*) AS "total!", COUNT(*) FILTER (WHERE created_by = $2) AS "own!"
           FROM item_attachments WHERE item_id = $1"#,
        item_id,
        member
    )
    .fetch_one(db)
    .await?;

    Ok(AttachmentCount {
        total: usize::try_from(row.total).unwrap_or(usize::MAX),
        own: usize::try_from(row.own).unwrap_or(usize::MAX),
    })
}

/// Attaches the uploader's own uploads to the item, keeping the given order.
/// Fails as a whole if any of them is not a claimable upload of theirs, so the
/// caller's transaction leaves the item untouched.
pub async fn attach(
    conn: &mut PgConnection,
    item_id: Uuid,
    uploader: Uuid,
    asset_ids: &[Uuid],
) -> AppResult<Vec<Uuid>> {
    let mut unique = asset_ids.to_vec();
    unique.sort_unstable();
    unique.dedup();
    if unique.len() != asset_ids.len() {
        return Err(invalid_upload());
    }

    // Time-ordered IDs keep attachments added in one statement, which share
    // their `created_at`, in the order they were sent.
    let attachment_ids: Vec<Uuid> = asset_ids.iter().map(|_| Uuid::now_v7()).collect();

    let attached = sqlx::query_scalar!(
        r#"INSERT INTO item_attachments (id, item_id, asset_id, created_by)
           SELECT requested.id, $1, a.id, $2
           FROM unnest($3::uuid[], $4::uuid[]) AS requested (id, asset_id)
           JOIN assets a ON a.id = requested.asset_id
           WHERE a.purpose = $5 AND a.uploaded_by = $2
             AND a.uploaded_at > now() - make_interval(hours => $6)
           ON CONFLICT (asset_id) DO NOTHING
           RETURNING id"#,
        item_id,
        uploader,
        &attachment_ids,
        asset_ids,
        AssetPurpose::Attachment as AssetPurpose,
        CLAIM_WINDOW_HOURS
    )
    .fetch_all(&mut *conn)
    .await?;

    if attached.len() != asset_ids.len() {
        return Err(invalid_upload());
    }

    Ok(attachment_ids)
}

/// Removes an attachment of the item; the file itself is left to the asset
/// sweep.
pub async fn detach(conn: &mut PgConnection, item_id: Uuid, attachment_id: Uuid) -> AppResult<()> {
    let removed = sqlx::query!(
        r#"DELETE FROM item_attachments WHERE id = $1 AND item_id = $2"#,
        attachment_id,
        item_id
    )
    .execute(conn)
    .await?
    .rows_affected();

    if removed == 0 {
        return Err(AppError::not_found("Attachment not found."));
    }

    Ok(())
}

pub async fn creator_of<'e>(
    db: impl PgExecutor<'e>,
    item_id: Uuid,
    attachment_id: Uuid,
) -> AppResult<Option<Uuid>> {
    sqlx::query_scalar!(
        r#"SELECT created_by FROM item_attachments WHERE id = $1 AND item_id = $2"#,
        attachment_id,
        item_id
    )
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::not_found("Attachment not found."))
}
