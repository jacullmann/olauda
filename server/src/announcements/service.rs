use super::dto::AnnouncementDto;
use crate::{
    common::text::DisplayText,
    error::{AppError, AppResult},
    realtime::event::{GroupTopic, Notice, publish},
    state::AppState,
};
use sqlx::PgPool;
use uuid::Uuid;

pub struct AnnouncementService {
    db: PgPool,
}

impl AnnouncementService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    /// Carries the read flag along so a client learns what is unread in the
    /// same round-trip, instead of fetching every read receipt separately.
    ///
    /// Announcements posted before the user joined count as read: a new member
    /// would otherwise have to click through the group's whole history. The
    /// same goes for the author's own posts and for visitors without a
    /// membership, such as superadmins, who are not the audience.
    pub async fn list(&self, tenant_id: Uuid, user_id: Uuid) -> AppResult<Vec<AnnouncementDto>> {
        let announcements = sqlx::query_as!(
            AnnouncementDto,
            r#"SELECT a.id, a.content, a.important,
                      a.created_by, a.created_at,
                      (
                          a.created_by IS NOT DISTINCT FROM $2
                          OR a.created_at < COALESCE(
                              (SELECT ur.assigned_at FROM user_roles ur
                               WHERE ur.user_id = $2 AND ur.tenant_id = $1),
                              'infinity'
                          )
                          OR EXISTS (
                              SELECT 1 FROM user_announcement_read_status r
                              WHERE r.announcement_id = a.id AND r.user_id = $2
                          )
                      ) AS "read!"
               FROM announcements a
               WHERE a.tenant_id = $1
               ORDER BY a.created_at DESC"#,
            tenant_id,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(announcements)
    }

    /// Ids outside the tenant are skipped by the join rather than reported, so
    /// the endpoint cannot be used to probe other groups' announcements.
    pub async fn mark_read(&self, tenant_id: Uuid, user_id: Uuid, ids: &[Uuid]) -> AppResult<()> {
        sqlx::query!(
            r#"INSERT INTO user_announcement_read_status (user_id, announcement_id)
               SELECT $1, a.id FROM announcements a
               WHERE a.tenant_id = $2 AND a.id = ANY($3)
               ON CONFLICT (user_id, announcement_id) DO NOTHING"#,
            user_id,
            tenant_id,
            ids
        )
        .execute(&self.db)
        .await?;

        publish(
            &self.db,
            [Notice::member(
                user_id,
                tenant_id,
                GroupTopic::Announcements,
            )],
        )
        .await?;

        Ok(())
    }

    pub async fn create(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        content: &DisplayText,
        important: bool,
    ) -> AppResult<AnnouncementDto> {
        let announcement = sqlx::query_as!(
            AnnouncementDto,
            r#"INSERT INTO announcements (tenant_id, content, important, created_by)
               VALUES ($1, $2, $3, $4)
               RETURNING id, content, important,
                         created_by, created_at, true AS "read!""#,
            tenant_id,
            content.as_str(),
            important,
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        publish(
            &self.db,
            [Notice::group(tenant_id, GroupTopic::Announcements)],
        )
        .await?;

        Ok(announcement)
    }

    pub async fn delete(&self, tenant_id: Uuid, id: Uuid) -> AppResult<()> {
        let deleted = sqlx::query!(
            r#"DELETE FROM announcements WHERE id = $1 AND tenant_id = $2"#,
            id,
            tenant_id
        )
        .execute(&self.db)
        .await?
        .rows_affected();

        if deleted == 0 {
            return Err(AppError::not_found("Announcement not found."));
        }

        publish(
            &self.db,
            [Notice::group(tenant_id, GroupTopic::Announcements)],
        )
        .await?;

        Ok(())
    }
}
