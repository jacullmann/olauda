use super::dto::{ReportDto, ReportedTaskDto};
use crate::{
    common::{client::ClientInfo, text::DisplayText},
    error::{AppError, AppResult},
    items::{attachments, item_type::ItemType},
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use serde_json::json;
use sqlx::{PgPool, types::Json};
use uuid::Uuid;

pub const REASON_MAX_CHARS: usize = 5000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReportType {
    Task,
}

impl ReportType {
    fn as_str(self) -> &'static str {
        match self {
            ReportType::Task => "task",
        }
    }
}

pub struct ReportsService {
    db: PgPool,
}

impl ReportsService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    pub async fn report_task(
        &self,
        tenant_id: Uuid,
        reporter_id: Uuid,
        reporter_email: &str,
        item_id: Uuid,
        reason: Option<&DisplayText>,
    ) -> AppResult<()> {
        let item = sqlx::query!(
            r#"SELECT i.id, i.type AS "type: ItemType", i.title,
                      COALESCE(s.name, i.custom_subject) AS "subject_name!", c.name AS "course_name?",
                      COALESCE(i.description, '') AS "description!", i.due_date,
                      COALESCE(i.editor_note, '') AS "editor_note!", i.tenant_id,
                      u.email AS "creator_email?: String"
               FROM items i
               LEFT JOIN subjects s ON s.id = i.subject_id
               LEFT JOIN courses c ON c.id = i.course_id
               LEFT JOIN users u ON u.id = i.created_by
               WHERE i.id = $1 AND i.tenant_id = $2"#,
            item_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("Item not found."))?;

        // A snapshot, so the report still shows what was reported after the
        // task is gone.
        let item_attachments = attachments::of_item(&self.db, item.id).await?;

        let details = ReportedTaskDto {
            item_id: item.id,
            item_title: item.title,
            item_type: Some(item.r#type),
            item_subject: item.subject_name,
            item_course: item.course_name,
            item_description: item.description,
            item_attachments: item_attachments.into_iter().map(|a| a.file).collect(),
            item_due_date: Some(item.due_date),
            item_editor_note: item.editor_note,
            item_tenant_id: Some(item.tenant_id),
            creator_email: item.creator_email,
        };

        self.insert(
            ReportType::Task,
            reason,
            reporter_id,
            reporter_email,
            details,
        )
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'item:report', $2)"#,
            reporter_id,
            json!({ "itemId": item.id })
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    async fn insert(
        &self,
        report_type: ReportType,
        reason: Option<&DisplayText>,
        reporter_id: Uuid,
        reporter_email: &str,
        details: ReportedTaskDto,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"INSERT INTO reports (report_type, reason, reporter_id, reporter_email, details)
               VALUES ($1, $2, $3, $4, $5)"#,
            report_type.as_str(),
            reason.map(DisplayText::as_str),
            reporter_id,
            reporter_email,
            Json(details) as _
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn list(&self) -> AppResult<Vec<ReportDto>> {
        let rows = sqlx::query!(
            r#"SELECT r.id, r.report_type, r.reason, r.reporter_id AS "reported_by", r.reporter_email,
                      r.reported_at, r.details AS "task: Json<ReportedTaskDto>",
                      NOT EXISTS (
                        SELECT 1 FROM items WHERE id = (r.details->>'itemId')::uuid
                      ) AS "content_deleted!"
               FROM reports r
               ORDER BY r.reported_at DESC"#
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| ReportDto {
                id: r.id,
                report_type: r.report_type,
                reason: r.reason,
                reported_by: r.reported_by,
                reporter_email: r.reporter_email,
                reported_at: r.reported_at,
                task: r.task.0,
                content_deleted: r.content_deleted,
            })
            .collect())
    }

    pub async fn delete(
        &self,
        report_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        let res = sqlx::query!(r#"DELETE FROM reports WHERE id = $1"#, report_id)
            .execute(&mut *tx)
            .await?;

        if res.rows_affected() == 0 {
            return Err(AppError::not_found("Report not found."));
        }

        SecurityEvent::new(SecurityEventKind::AdminReportDeleted)
            .actor(admin_id)
            .client(client)
            .metadata(json!({ "reportId": report_id }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(())
    }
}
