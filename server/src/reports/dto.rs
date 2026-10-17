use crate::{assets::dto::FileDto, items::item_type::ItemType};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// The reported task as it was when reported, so the report still shows it
/// after the task is gone. Snapshots taken by earlier versions lack some
/// fields, which is why most of them may be missing.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportedTaskDto {
    pub item_id: Uuid,
    #[serde(default)]
    pub item_title: String,
    pub item_type: Option<ItemType>,
    #[serde(default)]
    pub item_subject: String,
    pub item_course: Option<String>,
    #[serde(default)]
    pub item_description: String,
    #[serde(default)]
    pub item_attachments: Vec<FileDto>,
    pub item_due_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub item_editor_note: String,
    pub item_tenant_id: Option<Uuid>,
    pub creator_email: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportDto {
    pub id: Uuid,
    pub report_type: String,
    pub reason: Option<String>,
    pub reported_by: Option<Uuid>,
    pub reporter_email: Option<String>,
    pub reported_at: DateTime<Utc>,
    #[serde(flatten)]
    pub task: ReportedTaskDto,
    /// The reported task no longer exists; only its snapshot is left.
    pub content_deleted: bool,
}
