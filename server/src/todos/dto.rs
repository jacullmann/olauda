use crate::{
    common::{names::DisplayName, text::DisplayText},
    error::AppResult,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

const TITLE_MAX_CHARS: usize = 100;
const DESCRIPTION_MAX_CHARS: usize = 2000;

/// Creates a private task or replaces the text of an existing one.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TodoContentDto {
    pub title: String,
    pub description: Option<String>,
}

/// A private task's text once it is known to be valid.
pub struct TodoContent {
    title: DisplayName,
    description: Option<DisplayText>,
}

impl TodoContentDto {
    pub fn parse(&self) -> AppResult<TodoContent> {
        Ok(TodoContent {
            title: DisplayName::parse(&self.title, TITLE_MAX_CHARS, "title")?,
            description: DisplayText::parse_optional(
                self.description.as_deref(),
                DESCRIPTION_MAX_CHARS,
                "description",
            )?,
        })
    }
}

impl TodoContent {
    pub fn title(&self) -> &str {
        self.title.as_str()
    }

    /// Stored and returned as '' when absent, so clients always get a string.
    pub fn description(&self) -> &str {
        self.description.as_ref().map_or("", DisplayText::as_str)
    }
}

/// Moves a private task right below another, or to the top without one.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MoveTodoDto {
    pub after_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetTodoCompletedDto {
    pub completed: bool,
}

/// A private task, decrypted for its owner.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TodoDto {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub completed: bool,
    /// A fractional index; the list is sorted by it.
    pub position: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TodoCompletionDto {
    pub id: Uuid,
    pub completed: bool,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TodoMovedDto {
    pub id: Uuid,
    pub position: String,
    pub updated_at: DateTime<Utc>,
}
