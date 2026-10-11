//! Deletes stored files that nothing references anymore (`orphaned_assets()`
//! in the database), in Cloudinary first and then from the inventory.

use crate::common::cloudinary::{Cloudinary, ResourceType};
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::MissedTickBehavior;

const SWEEP_INTERVAL: Duration = Duration::from_secs(5 * 60);
/// Bounds the Cloudinary calls of one pass; a backlog drains over several.
const SWEEP_BATCH_SIZE: i64 = 100;
/// Its heartbeat tells the superadmin overview whether the sweep keeps up.
const SWEEP_WORKER: &str = "asset-sweep";

pub fn spawn(db: PgPool, cloudinary: Cloudinary) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(SWEEP_INTERVAL);
        interval.set_missed_tick_behavior(MissedTickBehavior::Delay);

        loop {
            interval.tick().await;
            if let Err(e) = sweep_orphaned_assets(&db, &cloudinary).await {
                tracing::warn!("Asset sweep failed: {e}");
            }
        }
    });
}

async fn sweep_orphaned_assets(db: &PgPool, cloudinary: &Cloudinary) -> sqlx::Result<()> {
    let orphaned = sqlx::query!(
        r#"SELECT id AS "id!", public_id AS "public_id!",
                  resource_type AS "resource_type!: ResourceType"
           FROM orphaned_assets()
           ORDER BY uploaded_at
           LIMIT $1"#,
        SWEEP_BATCH_SIZE
    )
    .fetch_all(db)
    .await?;

    let picked = orphaned.len();
    let mut deleted = Vec::with_capacity(picked);
    for asset in orphaned {
        match cloudinary
            .destroy(&asset.public_id, asset.resource_type)
            .await
        {
            Ok(()) => deleted.push(asset.id),
            // Stays recorded and is retried on the next pass.
            Err(e) => tracing::warn!(public_id = asset.public_id, "Cloudinary delete failed: {e}"),
        }
    }

    if !deleted.is_empty() {
        sqlx::query!(r#"DELETE FROM assets WHERE id = ANY($1)"#, &deleted)
            .execute(db)
            .await?;
    }

    // A pass only counts once every orphan it picked is gone, so a Cloudinary
    // outage shows up in the overview instead of hiding behind a running loop.
    if deleted.len() == picked {
        sqlx::query!(
            r#"INSERT INTO worker_heartbeats (worker, succeeded_at) VALUES ($1, now())
               ON CONFLICT (worker) DO UPDATE SET succeeded_at = EXCLUDED.succeeded_at"#,
            SWEEP_WORKER
        )
        .execute(db)
        .await?;
    }

    Ok(())
}
