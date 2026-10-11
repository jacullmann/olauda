//! Files members upload: task attachments, their previews and group pictures.
//!
//! Every file passes through the server, which recognises it by its content,
//! enforces the size limits and only then stores it in Cloudinary under an ID
//! of its choosing. Each stored file is recorded before it is uploaded, and a
//! periodic sweep deletes recorded files that nothing references anymore, so
//! deleting a task, replacing a group picture or abandoning an upload needs no
//! cleanup code of its own.

pub mod dto;
pub mod file_kind;
pub mod handlers;
mod relocate;
pub mod routes;
pub mod service;
mod sweep;

use crate::common::cloudinary::Cloudinary;
use sqlx::PgPool;

/// Relocation finishes before the first sweep, so the sweep never deletes a
/// file by an ID that is being renamed at the same moment.
pub fn spawn_maintenance(db: PgPool, cloudinary: Cloudinary) {
    tokio::spawn(async move {
        if let Err(e) = relocate::move_assets_into_their_folders(&db, &cloudinary).await {
            tracing::warn!("Asset relocation failed: {e}");
        }
        sweep::run(db, cloudinary).await;
    });
}
