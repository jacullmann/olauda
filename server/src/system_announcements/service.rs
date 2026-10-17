use super::dto::{
    AdminSystemAnnouncementDto, SystemAnnouncementDto, SystemAnnouncementInput,
    SystemAnnouncementStatus,
};
use crate::{
    common::client::ClientInfo,
    error::{AppError, AppResult},
    realtime::event::{Notice, PlatformTopic, publish},
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SystemAnnouncementService {
    db: PgPool,
}

impl SystemAnnouncementService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    /// The running announcements the user has yet to read, newest first.
    /// Once read, an announcement is gone for them: it is listed nowhere. The
    /// author's own count as read, as they do in groups.
    pub async fn list_unread(&self, user_id: Uuid) -> AppResult<Vec<SystemAnnouncementDto>> {
        let announcements = sqlx::query_as!(
            SystemAnnouncementDto,
            r#"SELECT a.id, a.content, a.important, a.starts_at AS published_at
               FROM system_announcements a
               WHERE a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
                 AND a.created_by IS DISTINCT FROM $1
                 AND NOT EXISTS (
                     SELECT 1 FROM system_announcement_reads r
                     WHERE r.announcement_id = a.id AND r.user_id = $1
                 )
               ORDER BY a.starts_at DESC, a.id"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(announcements)
    }

    /// Only running announcements can be read, so ids of scheduled, ended or
    /// unknown ones are skipped rather than reported.
    pub async fn mark_read(&self, user_id: Uuid, ids: &[Uuid]) -> AppResult<()> {
        sqlx::query!(
            r#"INSERT INTO system_announcement_reads (user_id, announcement_id)
               SELECT $1, a.id FROM system_announcements a
               WHERE a.id = ANY($2)
                 AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
               ON CONFLICT (user_id, announcement_id) DO NOTHING"#,
            user_id,
            ids
        )
        .execute(&self.db)
        .await?;

        publish(
            &self.db,
            [Notice::platform_for(
                user_id,
                PlatformTopic::SystemAnnouncements,
            )],
        )
        .await?;

        Ok(())
    }

    /// Running and scheduled announcements, latest start first.
    pub async fn list_for_admin(&self) -> AppResult<Vec<AdminSystemAnnouncementDto>> {
        let rows = sqlx::query!(
            r#"SELECT a.id, a.content, a.important, a.starts_at, a.ends_at,
                      u.email AS "author_email?",
                      a.starts_at > now() AS "scheduled!",
                      (SELECT COUNT(*) FROM system_announcement_reads r
                       WHERE r.announcement_id = a.id) AS "read_count!"
               FROM system_announcements a
               LEFT JOIN users u ON u.id = a.created_by
               WHERE a.ends_at IS NULL OR a.ends_at > now()
               ORDER BY a.starts_at DESC, a.id"#
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|a| AdminSystemAnnouncementDto {
                id: a.id,
                content: a.content,
                important: a.important,
                status: SystemAnnouncementStatus::from_scheduled(a.scheduled),
                starts_at: a.starts_at,
                ends_at: a.ends_at,
                author_email: a.author_email,
                read_count: a.read_count,
            })
            .collect())
    }

    pub async fn create(
        &self,
        input: &SystemAnnouncementInput,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Uuid> {
        let mut tx = self.db.begin().await?;

        let id = sqlx::query_scalar!(
            r#"INSERT INTO system_announcements (content, important, starts_at, ends_at, created_by)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id"#,
            input.content.as_str(),
            input.important,
            input.starts_at,
            input.ends_at,
            admin_id
        )
        .fetch_one(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::AdminAnnouncementCreated)
            .actor(admin_id)
            .client(client)
            .metadata(json!({ "announcementId": id }))
            .record(&mut *tx)
            .await?;

        publish(
            &mut *tx,
            [Notice::platform(PlatformTopic::SystemAnnouncements)],
        )
        .await?;
        tx.commit().await?;

        Ok(id)
    }

    /// Users who have read an announcement would never see a later change to
    /// it, so only scheduled ones can be edited.
    pub async fn update(
        &self,
        id: Uuid,
        input: &SystemAnnouncementInput,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        let updated = sqlx::query!(
            r#"UPDATE system_announcements
               SET content = $2, important = $3, starts_at = $4, ends_at = $5
               WHERE id = $1 AND starts_at > now()"#,
            id,
            input.content.as_str(),
            input.important,
            input.starts_at,
            input.ends_at
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if updated == 0 {
            let exists = sqlx::query_scalar!(
                r#"SELECT EXISTS (SELECT 1 FROM system_announcements WHERE id = $1) AS "exists!""#,
                id
            )
            .fetch_one(&mut *tx)
            .await?;

            return Err(if exists {
                AppError::bad_request("Only scheduled announcements can be edited.")
            } else {
                AppError::not_found("Announcement not found.")
            });
        }

        SecurityEvent::new(SecurityEventKind::AdminAnnouncementUpdated)
            .actor(admin_id)
            .client(client)
            .metadata(json!({ "announcementId": id }))
            .record(&mut *tx)
            .await?;

        publish(
            &mut *tx,
            [Notice::platform(PlatformTopic::SystemAnnouncements)],
        )
        .await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn delete(&self, id: Uuid, admin_id: Uuid, client: &ClientInfo) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        let content = sqlx::query_scalar!(
            r#"DELETE FROM system_announcements WHERE id = $1 RETURNING content"#,
            id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("Announcement not found."))?;

        SecurityEvent::new(SecurityEventKind::AdminAnnouncementDeleted)
            .actor(admin_id)
            .client(client)
            .metadata(json!({ "announcementId": id, "content": content }))
            .record(&mut *tx)
            .await?;

        publish(
            &mut *tx,
            [Notice::platform(PlatformTopic::SystemAnnouncements)],
        )
        .await?;
        tx.commit().await?;

        Ok(())
    }
}
