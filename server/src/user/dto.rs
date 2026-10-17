use crate::common::{locale::Locale, theme::Theme};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePersonalizationDto {
    pub personalized: bool,
}

/// A course the user takes, with the subject it belongs to.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CourseSelectionDto {
    pub subject_id: Uuid,
    pub course_id: Uuid,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSetupDto {
    pub courses: Vec<CourseSelectionDto>,
}

/// Where a member moved a task against its natural place: into the archive,
/// or kept in the list although it would have been archived.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum VisibilityStatus {
    Archived,
    Kept,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityStatusDto {
    pub status: VisibilityStatus,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ItemIdsDto {
    pub item_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityDto {
    pub archived: Vec<Uuid>,
    pub kept: Vec<Uuid>,
}

/// Hints a user can hide for good. Each page keeps its own entry, so hiding a
/// hint on one page leaves it in place on the others.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum DismissibleNotice {
    PersonalizedTasks,
    PersonalizedSchedule,
    PrivateTasks,
}

impl DismissibleNotice {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::PersonalizedTasks => "personalizedTasks",
            Self::PersonalizedSchedule => "personalizedSchedule",
            Self::PrivateTasks => "privateTasks",
        }
    }
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Path)]
pub struct NoticePath {
    pub notice: DismissibleNotice,
}

/// The settings a request changes; omitted ones keep their stored value. Every
/// field has a closed type, so the stored preferences stay small and readable
/// by whatever reads them.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePreferencesDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<Theme>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<Locale>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tasks: Option<TaskPreferencesDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule: Option<SchedulePreferencesDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dashboard: Option<DashboardPreferencesDto>,
}

/// When checked tasks leave the list for the archive. The task list query
/// reads the stored names, so they must not change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveCheckedTasks {
    Always,
    AfterDueDate,
    Never,
}

#[derive(Debug, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TaskPreferencesDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive_checked: Option<ArchiveCheckedTasks>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_by_due_date: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive_other_courses_past_due: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum NowMarkerTime {
    Remaining,
    Duration,
}

#[derive(Debug, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SchedulePreferencesDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlight_next_lesson: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub now_marker: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub now_marker_time: Option<NowMarkerTime>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_breaks_in_free_time: Option<bool>,
}

#[derive(Debug, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DashboardPreferencesDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tagline: Option<bool>,
}

/// The settings as stored. Settings the user never changed are absent, and
/// the client applies its defaults for them.
#[derive(Debug, Default, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct PreferencesDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<Theme>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<Locale>,
    pub tasks: TaskPreferencesDto,
    pub schedule: SchedulePreferencesDto,
    pub dashboard: DashboardPreferencesDto,
    pub dismissed_notices: Vec<DismissibleNotice>,
}

impl PreferencesDto {
    /// Reads the stored settings. Only the server writes them, through the
    /// closed types above, so a value it cannot read is a bug; the user still
    /// gets the defaults rather than an error.
    pub fn from_stored(stored: serde_json::Value) -> Self {
        serde_json::from_value(stored).unwrap_or_else(|err| {
            tracing::error!("Unreadable stored preferences: {err}");
            Self::default()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_notice_names_match_the_route_names() {
        for notice in [
            DismissibleNotice::PersonalizedTasks,
            DismissibleNotice::PersonalizedSchedule,
            DismissibleNotice::PrivateTasks,
        ] {
            let parsed: DismissibleNotice =
                serde_json::from_value(serde_json::json!(notice.as_str())).unwrap();
            assert_eq!(parsed, notice);
        }
    }

    #[test]
    fn archive_setting_keeps_the_names_the_task_list_reads() {
        for (setting, stored) in [
            (ArchiveCheckedTasks::Always, "always"),
            (ArchiveCheckedTasks::AfterDueDate, "afterDueDate"),
            (ArchiveCheckedTasks::Never, "never"),
        ] {
            assert_eq!(serde_json::to_value(setting).unwrap(), stored);
        }
    }

    #[test]
    fn dashboard_setting_is_kept_for_storage() {
        let changed = serde_json::json!({ "dashboard": { "tagline": false } });
        let dto: UpdatePreferencesDto = serde_json::from_value(changed).unwrap();
        let stored = serde_json::to_value(dto).unwrap();
        assert_eq!(stored["dashboard"], serde_json::json!({ "tagline": false }));
    }

    #[test]
    fn stored_preferences_read_back_with_their_dismissed_notices() {
        let stored = serde_json::json!({
            "theme": "dark",
            "tasks": { "groupByDueDate": true },
            "dismissedNotices": ["privateTasks"],
        });
        let preferences = PreferencesDto::from_stored(stored);
        assert_eq!(preferences.theme, Some(Theme::Dark));
        assert_eq!(preferences.tasks.group_by_due_date, Some(true));
        assert_eq!(
            preferences.dismissed_notices,
            [DismissibleNotice::PrivateTasks]
        );
    }

    #[test]
    fn unknown_task_settings_are_refused() {
        let invalid = serde_json::json!({ "tasks": { "archiveChecked": "sometimes" } });
        assert!(serde_json::from_value::<UpdatePreferencesDto>(invalid).is_err());
    }
}
