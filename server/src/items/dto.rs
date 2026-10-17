use super::{attachments::AttachmentDto, item_type::ItemType};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;
use validator::Validate;

/// What a task is about: a subject of the group, optionally narrowed to one of
/// its courses, or a subject typed in by hand that the group does not offer.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum ItemSubjectDto {
    #[serde(rename_all = "camelCase")]
    Group {
        subject_id: Uuid,
        course_id: Option<Uuid>,
    },
    #[serde(rename_all = "camelCase")]
    Custom { custom_name: String },
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemDto {
    pub r#type: ItemType,
    #[validate(length(min = 1, max = 60))]
    pub title: String,
    pub subject: ItemSubjectDto,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    /// Uploads of the creator to attach, in display order.
    #[serde(default)]
    pub attachment_ids: Vec<Uuid>,
    pub due_date: DateTime<Utc>,
    /// Creates the task even though one for the same subject and day exists.
    #[serde(default)]
    pub confirm_duplicate: bool,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemDto {
    #[validate(length(min = 1, max = 60))]
    pub title: Option<String>,
    pub subject: Option<ItemSubjectDto>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddAttachmentDto {
    pub asset_id: Uuid,
}

pub const NOTE_MAX_CHARS: usize = 2000;

/// An empty note removes the current one.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEditorNoteDto {
    pub editor_note: String,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReportItemDto {
    pub item_id: Uuid,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct ItemsQuery {
    /// Every type when left out.
    pub r#type: Option<ItemType>,
    /// The archive instead of the current tasks.
    #[serde(default)]
    pub archived: bool,
    pub subject_id: Option<Uuid>,
    #[serde(default)]
    pub hide_checked: bool,
    /// Leaves out tasks of courses the member does not take.
    #[serde(default)]
    pub personalized: bool,
}

/// How close a task is to its due date.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum TimeColor {
    Expired,
    Danger,
    Warn,
    Normal,
    Ok,
}

impl TimeColor {
    pub fn until(due: DateTime<Utc>, now: DateTime<Utc>) -> Self {
        let days_left = (due - now).num_seconds() as f64 / 86_400.0;
        match days_left {
            d if d < 0.0 => Self::Expired,
            d if d < 1.0 => Self::Danger,
            d if d < 2.0 => Self::Warn,
            d if d < 3.0 => Self::Normal,
            _ => Self::Ok,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ItemDto {
    pub id: Uuid,
    pub r#type: ItemType,
    pub title: String,
    /// `None` when the subject was typed in by hand instead of picked.
    pub subject_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    /// A `common.subjects.*` key or the name the group owner typed.
    pub subject_name: String,
    pub course_name: Option<String>,
    /// Whether the member takes the task's course.
    pub takes_course: bool,
    pub description: String,
    pub attachments: Vec<AttachmentDto>,
    pub due_date: DateTime<Utc>,
    /// `None` once the creator deleted their account.
    pub created_by: Option<Uuid>,
    /// The creator's pseudonym, the same in every group.
    pub created_by_name: Option<String>,
    /// Only for superadmins, who need it to follow up on reports.
    pub created_by_email: Option<String>,
    pub time_color: TimeColor,
    pub editor_note: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ItemListDto {
    pub items: Vec<ItemDto>,
    /// How many tasks a personalized list left out because they belong to
    /// courses the member does not take.
    pub hidden_by_courses: usize,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EditorNoteDto {
    pub editor_note: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;

    #[test]
    fn time_color_tracks_the_days_left() {
        let now = Utc::now();
        let color = |hours| TimeColor::until(now + TimeDelta::hours(hours), now);

        assert_eq!(color(-1), TimeColor::Expired);
        assert_eq!(color(12), TimeColor::Danger);
        assert_eq!(color(36), TimeColor::Warn);
        assert_eq!(color(60), TimeColor::Normal);
        assert_eq!(color(96), TimeColor::Ok);
    }
}
