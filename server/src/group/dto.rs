use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;
use validator::Validate;

use crate::common::{
    group_type::{CourseType, GroupType, SubjectCategory},
    patch,
    permission::{GroupPermissions, Permission},
    role::{MemberRole, Role},
    school_week::WeekStart,
};

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupDto {
    pub group_name: String,
    /// An upload from `/uploads/group-avatar`.
    pub avatar_id: Option<Uuid>,
    #[serde(default)]
    pub group_type: GroupType,
    #[serde(default)]
    pub dalton_enabled: bool,
}

/// A group as the client sees it, including what the caller may do in it, so
/// the UI never has to re-derive permissions from the raw matrix.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupSummaryDto {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub role: Role,
    pub schedule_config: ScheduleConfigDto,
    pub avatar_url: Option<String>,
    /// Resolved against the defaults, so clients never need to know them.
    pub permissions: GroupPermissions,
    pub group_type: GroupType,
    pub dalton_enabled: bool,
    pub effective_permissions: Vec<Permission>,
    pub course_setup: CourseSetup,
    /// A superadmin banned the group: only superadmins can still open it.
    pub banned: bool,
    /// The caller may read the group but not change anything in it.
    pub muted: bool,
}

/// Where the caller stands with picking their courses in a group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CourseSetup {
    /// Picked or skipped; the group's pages show only the chosen courses.
    Done,
    /// The group offers courses the member has not been asked about yet.
    Pending,
    /// Nothing to pick, or the caller is not a member.
    NotNeeded,
}

impl CourseSetup {
    pub fn of(done: bool, offers_course_choice: bool) -> Self {
        match (done, offers_course_choice) {
            (true, _) => Self::Done,
            (false, true) => Self::Pending,
            (false, false) => Self::NotNeeded,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupStatusDto {
    pub authenticated: bool,
    pub groups: Vec<GroupSummaryDto>,
    /// Where the app opens after sign-in; never used to scope a request.
    pub landing_group_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupMemberDto {
    pub user_id: Uuid,
    pub generated_name: String,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    /// What the requesting user may change this member's role to.
    pub assignable_roles: Vec<MemberRole>,
    /// Whether the requesting user may remove this member.
    pub can_remove: bool,
    /// Left out unless the requesting user may mute this member: a mute is
    /// between the member and the group's moderators.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub muted: Option<bool>,
    /// Whether the requesting user may mute or unmute this member.
    pub can_mute: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BannedMemberDto {
    pub user_id: Uuid,
    pub generated_name: String,
    pub banned_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InviteCreatedDto {
    /// The secret the invite link carries.
    pub token: String,
}

/// What an invite link shows before joining. The group's id is only revealed
/// to members, so the preview stays anonymous for everyone else.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InvitePreviewDto {
    pub group_name: String,
    pub avatar_url: Option<String>,
    pub member_count: i64,
    pub already_member: bool,
    pub group_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InviteAcceptedDto {
    pub group_id: Uuid,
    /// The user was a member before; the invite stays unused.
    pub already_member: bool,
}

/// An invite as moderators review it. The token is only handed out while the
/// invite can still be used.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupInviteDto {
    pub id: Uuid,
    pub token: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub used_by: Option<Uuid>,
    pub used_by_name: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_by: Option<Uuid>,
    pub revoked_by_name: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransferOwnershipDto {
    pub target_user_id: Uuid,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangeMemberRoleDto {
    pub role: Role,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct RemoveMemberQuery {
    /// Also keeps the member from joining again.
    #[serde(default)]
    pub ban: bool,
}

/// Only the sent settings change.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupSettingsDto {
    pub name: Option<String>,
    /// An upload from `/uploads/group-avatar`; `null` removes the picture.
    #[serde(default, deserialize_with = "patch::nullable")]
    #[schema(value_type = Option<Uuid>)]
    pub avatar_id: Option<Option<Uuid>>,
    pub group_type: Option<GroupType>,
    pub dalton_enabled: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceScheduleDto {
    pub lessons: Vec<ScheduleLessonDto>,
    pub schedule_config: ScheduleConfigDto,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleLessonDto {
    /// Left out for a new lesson.
    pub id: Option<Uuid>,
    pub day: i32,
    pub slot: i32,
    pub duration: i32,
    pub room: Option<String>,
    pub subject_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    #[serde(default)]
    pub is_dalton: bool,
}

/// When the school day starts and how its slots and breaks are laid out.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfigDto {
    /// `HH:MM`
    pub start_time: String,
    pub total_slots: i32,
    pub lesson_duration_mins: i32,
    /// Minutes of break after a slot, on every day without breaks of its own.
    #[serde(default)]
    pub breaks: BTreeMap<i32, i32>,
    /// The days whose breaks differ, each with all of its breaks.
    #[serde(default)]
    pub day_breaks: BTreeMap<i32, BTreeMap<i32, i32>>,
}

impl Default for ScheduleConfigDto {
    /// Matches the column default new groups get.
    fn default() -> Self {
        Self {
            start_time: "08:00".to_owned(),
            total_slots: 8,
            lesson_duration_mins: 45,
            breaks: BTreeMap::new(),
            day_breaks: BTreeMap::new(),
        }
    }
}

impl ScheduleConfigDto {
    /// Only the validated schedule editor writes the stored configuration, so
    /// one that cannot be read is a bug; the group still gets a usable day.
    pub fn from_stored(stored: serde_json::Value) -> Self {
        serde_json::from_value(stored).unwrap_or_else(|err| {
            tracing::error!("Unreadable schedule configuration: {err}");
            Self::default()
        })
    }
}

/// The one change a lesson carries in one week, replacing whatever change it
/// had that week before.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleSubDto {
    pub lesson_id: Uuid,
    pub week_start: WeekStart,
    pub course_id: Option<Uuid>,
    pub day: Option<i32>,
    pub slot: Option<i32>,
    pub duration: Option<i32>,
    pub subject: Option<String>,
    pub room: Option<String>,
    pub cancelled: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubjectDto {
    pub name: String,
    /// The group type's default when left out.
    pub category: Option<SubjectCategory>,
    #[serde(default)]
    pub is_dalton: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubjectDto {
    pub name: Option<String>,
    pub category: Option<SubjectCategory>,
    pub is_dalton: Option<bool>,
}

/// Only the permissions to change; the others keep their current role.
#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupPermissionsDto {
    #[validate(custom(function = "validate_required_roles"))]
    pub permissions: BTreeMap<Permission, Role>,
}

fn validate_required_roles(
    permissions: &BTreeMap<Permission, Role>,
) -> Result<(), validator::ValidationError> {
    if permissions
        .iter()
        .all(|(permission, role)| permission.accepts(*role))
    {
        Ok(())
    } else {
        Err(validator::ValidationError::new("role_not_accepted"))
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCourseDto {
    pub name: String,
    pub course_type: Option<CourseType>,
}

/// A course keeps its type when none is sent.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCourseDto {
    pub name: String,
    pub course_type: Option<CourseType>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_schedule_configurations_read_back() {
        let stored = serde_json::json!({
            "breaks": { "2": 25 },
            "startTime": "07:45",
            "totalSlots": 9,
            "lessonDurationMins": 45,
        });
        let config = ScheduleConfigDto::from_stored(stored);

        assert_eq!(config.start_time, "07:45");
        assert_eq!(config.breaks.get(&2), Some(&25));
        assert!(config.day_breaks.is_empty());
    }
}
