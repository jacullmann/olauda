//! Moves stored files into the Cloudinary folder of their purpose, both their
//! public ID and their place in the Media Library. Files already in place are
//! left alone, so once everything has moved a start finds nothing to do, and
//! a file that failed to move is retried on the next start.

use super::service::AssetPurpose;
use crate::common::cloudinary::{AssetFolder, Cloudinary, CloudinaryError, ResourceType};
use sqlx::PgPool;
use uuid::Uuid;

/// How many moves are committed together; an interrupted run repeats at most
/// this many, which every step tolerates.
const RELOCATE_BATCH_SIZE: usize = 100;

struct MisplacedAsset {
    id: Uuid,
    public_id: String,
    resource_type: ResourceType,
    folder: AssetFolder,
}

pub async fn move_assets_into_their_folders(
    db: &PgPool,
    cloudinary: &Cloudinary,
) -> sqlx::Result<()> {
    let misplaced: Vec<_> = sqlx::query!(
        r#"SELECT id, public_id, resource_type AS "resource_type: ResourceType",
                  purpose AS "purpose: AssetPurpose"
           FROM assets
           ORDER BY uploaded_at"#
    )
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|row| MisplacedAsset {
        id: row.id,
        folder: row.purpose.folder(),
        public_id: row.public_id,
        resource_type: row.resource_type,
    })
    .filter(|asset| asset.folder.public_id_for(&asset.public_id) != asset.public_id)
    .collect();

    if misplaced.is_empty() {
        return Ok(());
    }
    tracing::info!(
        count = misplaced.len(),
        "Moving assets into their Cloudinary folders"
    );

    let mut failed = 0;
    for batch in misplaced.chunks(RELOCATE_BATCH_SIZE) {
        let mut moved = MovedAssets::default();
        for asset in batch {
            match move_asset(cloudinary, asset).await {
                Ok(new_public_id) => moved.push(asset.id, &asset.public_id, new_public_id),
                Err(e) => {
                    failed += 1;
                    tracing::warn!(public_id = asset.public_id, "Moving an asset failed: {e}");
                }
            }
        }
        record_moves(db, &moved).await?;
    }

    tracing::info!(
        moved = misplaced.len() - failed,
        failed,
        "Finished moving assets into their Cloudinary folders"
    );
    Ok(())
}

/// The folder is set before the rename, because it is addressed by the old
/// public ID: once the rename went through, the folder is already right.
async fn move_asset(
    cloudinary: &Cloudinary,
    asset: &MisplacedAsset,
) -> Result<String, CloudinaryError> {
    let new_public_id = asset.folder.public_id_for(&asset.public_id);
    cloudinary
        .move_to_folder(&asset.public_id, asset.folder, asset.resource_type)
        .await?;
    cloudinary
        .rename(&asset.public_id, &new_public_id, asset.resource_type)
        .await?;
    Ok(new_public_id)
}

#[derive(Default)]
struct MovedAssets {
    ids: Vec<Uuid>,
    old_public_ids: Vec<String>,
    new_public_ids: Vec<String>,
}

impl MovedAssets {
    fn push(&mut self, id: Uuid, old_public_id: &str, new_public_id: String) {
        self.ids.push(id);
        self.old_public_ids.push(old_public_id.to_owned());
        self.new_public_ids.push(new_public_id);
    }
}

/// Points the inventory and the attachment snapshots kept in reports at the
/// new IDs.
async fn record_moves(db: &PgPool, moved: &MovedAssets) -> sqlx::Result<()> {
    if moved.ids.is_empty() {
        return Ok(());
    }

    let mut tx = db.begin().await?;

    sqlx::query!(
        r#"UPDATE assets a
           SET public_id = moved.new_public_id
           FROM unnest($1::uuid[], $2::text[]) AS moved(id, new_public_id)
           WHERE a.id = moved.id"#,
        &moved.ids,
        &moved.new_public_ids
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        r#"WITH moved(old_public_id, new_public_id) AS (
               SELECT * FROM unnest($1::text[], $2::text[])
           )
           UPDATE reports r
           SET details = jsonb_set(r.details, '{itemAttachments}', (
               SELECT jsonb_agg(
                          attachment
                          || COALESCE((SELECT jsonb_build_object('publicId', m.new_public_id)
                                       FROM moved m
                                       WHERE m.old_public_id = attachment ->> 'publicId'), '{}')
                          || COALESCE((SELECT jsonb_build_object('thumbnailPublicId', m.new_public_id)
                                       FROM moved m
                                       WHERE m.old_public_id = attachment ->> 'thumbnailPublicId'), '{}')
                          ORDER BY position)
               FROM jsonb_array_elements(r.details -> 'itemAttachments')
                    WITH ORDINALITY AS attachments(attachment, position)
           ))
           WHERE jsonb_typeof(r.details -> 'itemAttachments') = 'array'
             AND EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements(r.details -> 'itemAttachments') AS attachments(attachment),
                      moved m
                 WHERE m.old_public_id IN (attachment ->> 'publicId', attachment ->> 'thumbnailPublicId')
             )"#,
        &moved.old_public_ids,
        &moved.new_public_ids
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await
}
