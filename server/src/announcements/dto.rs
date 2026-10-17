use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// Announcements are read at a glance, so they stay as short as an SMS.
pub const CONTENT_MAX_CHARS: usize = 160;

/// An announcement as one member sees it.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnnouncementDto {
    pub id: Uuid,
    pub content: String,
    pub important: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub read: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnnouncementDto {
    pub content: String,
    #[serde(default)]
    pub important: bool,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkAnnouncementsReadDto {
    /// Clearing all sends every unread id at once.
    #[validate(length(min = 1, max = 500))]
    pub ids: Vec<Uuid>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_important_when_omitted() {
        let dto: CreateAnnouncementDto = serde_json::from_str(r#"{"content":"x"}"#).unwrap();
        assert!(!dto.important);
    }
}
