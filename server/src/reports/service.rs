use crate::{
    common::{client::ClientInfo, text::DisplayText},
    error::{AppError, AppResult},
    items::attachments,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use serde_json::{Value, json};
use sqlx::PgPool;
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
    ) -> AppResult<Value> {
        let item = sqlx::query!(
            r#"SELECT i.id, i.type, i.title,
                      COALESCE(s.name, i.custom_subject) AS "subject_name!", c.name AS "course_name?",
                      i.description, i.due_date, i.editor_note, i.tenant_id,
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

        let details = json!({
            "itemId": item.id,
            "itemTitle": item.title,
            "itemType": item.r#type,
            "itemSubject": item.subject_name,
            "itemCourse": item.course_name,
            "itemDescription": item.description,
            "itemAttachments": item_attachments,
            "itemDueDate": item.due_date,
            "itemEditorNote": item.editor_note,
            "itemTenantId": item.tenant_id,
            "creatorEmail": item.creator_email,
        });

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

        Ok(json!({ "ok": true, "message": "Item reported successfully." }))
    }

    async fn insert(
        &self,
        report_type: ReportType,
        reason: Option<&DisplayText>,
        reporter_id: Uuid,
        reporter_email: &str,
        details: Value,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"INSERT INTO reports (report_type, reason, reporter_id, reporter_email, details)
               VALUES ($1, $2, $3, $4, $5)"#,
            report_type.as_str(),
            reason.map(DisplayText::as_str),
            reporter_id,
            reporter_email,
            details
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// `contentDeleted` tells the admin UI that the reported task no longer
    /// exists, so it shows the snapshot kept in `details` instead.
    pub async fn list(&self) -> AppResult<Value> {
        let rows = sqlx::query!(
            r#"SELECT r.id, r.report_type, r.reason, r.reporter_id, r.reporter_email,
                      r.reported_at, r.details,
                      NOT EXISTS (
                        SELECT 1 FROM items WHERE id = (r.details->>'itemId')::uuid
                      ) AS "content_deleted!"
               FROM reports r
               ORDER BY r.reported_at DESC"#
        )
        .fetch_all(&self.db)
        .await?;

        let reports: Vec<Value> = rows
            .into_iter()
            .map(|r| {
                let mut map = match r.details {
                    Value::Object(map) => map,
                    _ => serde_json::Map::new(),
                };
                map.insert("id".into(), json!(r.id));
                map.insert("reportType".into(), json!(r.report_type));
                map.insert("reason".into(), json!(r.reason));
                map.insert("reportedBy".into(), json!(r.reporter_id));
                map.insert("reporterEmail".into(), json!(r.reporter_email));
                map.insert("reportedAt".into(), json!(r.reported_at));
                map.insert("contentDeleted".into(), json!(r.content_deleted));
                Value::Object(map)
            })
            .collect();

        Ok(json!(reports))
    }

    pub async fn delete(
        &self,
        report_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
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

        Ok(json!({ "ok": true }))
    }
}
