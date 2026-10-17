use super::dto::{AccessStatusDto, UpdateAccessControlsDto};
use crate::{
    common::{client::ClientInfo, role::Role},
    error::{AppError, AppResult},
    realtime::event::{Notice, PlatformTopic, publish},
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use serde::Serialize;
use serde_json::json;
use sqlx::{PgExecutor, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

/// The switches as stored and as superadmins manage them. Shutdown closes
/// sign-ups without touching `registration_paused`, so ending it restores
/// what sign-ups were set to.
#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccessControls {
    pub registration_paused: bool,
    pub shutdown: bool,
}

impl AccessControls {
    pub const fn registration_open(self) -> bool {
        !self.registration_paused && !self.shutdown
    }
}

impl From<AccessControls> for AccessStatusDto {
    fn from(controls: AccessControls) -> Self {
        Self {
            registration_open: controls.registration_open(),
            shutdown: controls.shutdown,
        }
    }
}

pub async fn load(db: &PgPool) -> AppResult<AccessControls> {
    let controls = sqlx::query_as!(
        AccessControls,
        r#"SELECT registration_paused, shutdown FROM access_controls"#
    )
    .fetch_one(db)
    .await?;

    Ok(controls)
}

pub async fn ensure_registration_open(db: &PgPool) -> AppResult<()> {
    if load(db).await?.registration_open() {
        Ok(())
    } else {
        Err(AppError::RegistrationPaused)
    }
}

/// Whether the user may get a session. Superadmins are exempt from
/// shutdown, so they can still look into whatever it is for and end it.
pub async fn ensure_admitted<'e>(db: impl PgExecutor<'e>, user_id: Uuid) -> AppResult<()> {
    let admitted = sqlx::query_scalar!(
        r#"SELECT NOT ac.shutdown OR EXISTS (
                      SELECT 1 FROM user_roles
                      WHERE user_id = $1 AND tenant_id IS NULL AND role_id = $2
                  ) AS "admitted!"
           FROM access_controls ac"#,
        user_id,
        Role::Superadmin.db_id_i32()
    )
    .fetch_one(db)
    .await?;

    if admitted {
        Ok(())
    } else {
        Err(AppError::Shutdown)
    }
}

/// [`ensure_admitted`] for a password sign-in, before the password is
/// checked: during shutdown everyone but a superadmin gets the same answer
/// whether the password is right, wrong, or the account does not exist.
pub async fn ensure_email_admitted(db: &PgPool, email: &str) -> AppResult<()> {
    let admitted = sqlx::query_scalar!(
        r#"SELECT NOT ac.shutdown OR EXISTS (
                      SELECT 1 FROM users u
                      JOIN user_roles r ON r.user_id = u.id
                      WHERE u.email = $1 AND r.tenant_id IS NULL AND r.role_id = $2
                  ) AS "admitted!"
           FROM access_controls ac"#,
        email,
        Role::Superadmin.db_id_i32()
    )
    .fetch_one(db)
    .await?;

    if admitted {
        Ok(())
    } else {
        Err(AppError::Shutdown)
    }
}

pub struct AccessControlService {
    db: PgPool,
}

impl AccessControlService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    pub async fn update(
        &self,
        changes: &UpdateAccessControlsDto,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<AccessControls> {
        if changes.is_empty() {
            return Err(AppError::bad_request("No switch to change."));
        }

        let mut tx = self.db.begin().await?;

        let controls = sqlx::query_as!(
            AccessControls,
            r#"UPDATE access_controls
               SET registration_paused = COALESCE($1, registration_paused),
                   shutdown = COALESCE($2, shutdown)
               RETURNING registration_paused, shutdown"#,
            changes.registration_paused,
            changes.shutdown
        )
        .fetch_one(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::AdminAccessControlsChanged)
            .actor(admin_id)
            .client(client)
            .metadata(json!(changes))
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [Notice::platform(PlatformTopic::Access)]).await?;
        tx.commit().await?;

        Ok(controls)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn controls(registration_paused: bool, shutdown: bool) -> AccessControls {
        AccessControls {
            registration_paused,
            shutdown,
        }
    }

    #[test]
    fn registration_is_open_only_without_either_switch() {
        assert!(controls(false, false).registration_open());
        assert!(!controls(true, false).registration_open());
        assert!(!controls(false, true).registration_open());
        assert!(!controls(true, true).registration_open());
    }
}
