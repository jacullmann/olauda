use crate::common::{
    group_type::{CourseType, SubjectCategory},
    school_week::WeekStart,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

/// The weeks whose changes to fetch; a missing bound leaves that side open.
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ScheduleSubsQuery {
    pub from: Option<WeekStart>,
    pub to: Option<WeekStart>,
}

/// A lesson of the weekly timetable.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LessonDto {
    pub id: Uuid,
    /// 1 for Monday to 5 for Friday.
    pub day: i32,
    pub slot: i32,
    /// How many slots the lesson spans.
    pub duration: i32,
    pub room: Option<String>,
    pub subject_id: Option<Uuid>,
    pub subject_name: Option<String>,
    /// Set when the lesson belongs to one course of its subject only.
    pub course_id: Option<Uuid>,
    pub course_name: Option<String>,
    pub is_dalton: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDto {
    pub lessons: Vec<LessonDto>,
    /// How many lessons a personalized timetable left out because they belong
    /// to courses the member does not take.
    pub hidden_by_courses: usize,
}

/// A change to one week: a lesson cancelled, moved or added.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubstitutionDto {
    pub id: Uuid,
    /// The regular lesson it changes.
    pub lesson_id: Uuid,
    pub course_id: Option<Uuid>,
    pub week_start: NaiveDate,
    pub day: Option<i32>,
    pub slot: Option<i32>,
    pub duration: Option<i32>,
    pub subject: Option<String>,
    pub room: Option<String>,
    pub cancelled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CourseDto {
    pub id: Uuid,
    pub name: String,
    pub course_type: Option<CourseType>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubjectDto {
    pub id: Uuid,
    /// A `common.subjects.*` key or the name the group owner typed.
    pub name: String,
    pub category: SubjectCategory,
    pub is_dalton: bool,
    pub courses: Vec<CourseDto>,
}
