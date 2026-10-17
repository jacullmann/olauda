use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// How a group organises its subjects and its schedule.
///
/// A regular group is one class that attends every lesson together. An Abitur
/// group is a whole year in which nearly every lesson belongs to a single
/// course, so lessons are scheduled per course instead of per subject.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum GroupType {
    #[default]
    Regular,
    Abitur,
}

/// How members pick a subject's courses. Both sets describe how a member picks
/// a course, never how a course is graded.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum SubjectCategory {
    Core,
    Elective,
    Extra,
    Mandatory,
    Optional,
    /// Zusatzkurs: makes every course of the subject a ZK.
    Zk,
}

/// The level of an Abitur course; regular groups have none.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum CourseType {
    Gk,
    Lk,
    Zk,
}

impl GroupType {
    /// The subject categories that may be assigned in this kind of group.
    pub const fn subject_categories(self) -> &'static [SubjectCategory] {
        match self {
            Self::Regular => &[
                SubjectCategory::Core,
                SubjectCategory::Elective,
                SubjectCategory::Extra,
            ],
            Self::Abitur => &[
                SubjectCategory::Mandatory,
                SubjectCategory::Optional,
                SubjectCategory::Zk,
            ],
        }
    }

    /// The category a new subject gets when the client does not send one.
    pub const fn default_category(self) -> SubjectCategory {
        match self {
            Self::Regular => SubjectCategory::Core,
            Self::Abitur => SubjectCategory::Mandatory,
        }
    }

    pub fn allows_category(self, category: SubjectCategory) -> bool {
        self.subject_categories().contains(&category)
    }

    /// Only Abitur courses carry a GK/LK/ZK type.
    pub const fn uses_course_types(self) -> bool {
        matches!(self, Self::Abitur)
    }
}

/// The type a course ends up with. A Zusatzkurs subject forces ZK on all of
/// its courses, a regular group has no course types at all, and every other
/// Abitur subject lets the editor pick between GK and LK, GK by default.
/// Fails with the requested type when the editor may not pick it.
pub fn resolve_course_type(
    group_type: GroupType,
    subject_category: SubjectCategory,
    requested: Option<CourseType>,
) -> Result<Option<CourseType>, CourseType> {
    if !group_type.uses_course_types() {
        return Ok(None);
    }

    if subject_category == SubjectCategory::Zk {
        return Ok(Some(CourseType::Zk));
    }

    match requested {
        None => Ok(Some(CourseType::Gk)),
        Some(CourseType::Zk) => Err(CourseType::Zk),
        Some(picked) => Ok(Some(picked)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn categories_are_scoped_to_the_group_type() {
        assert!(GroupType::Regular.allows_category(SubjectCategory::Core));
        assert!(!GroupType::Regular.allows_category(SubjectCategory::Mandatory));
        assert!(GroupType::Abitur.allows_category(SubjectCategory::Mandatory));
        assert!(!GroupType::Abitur.allows_category(SubjectCategory::Core));
    }

    #[test]
    fn new_subjects_get_a_category_of_their_group_type() {
        for group_type in [GroupType::Regular, GroupType::Abitur] {
            assert!(group_type.allows_category(group_type.default_category()));
        }
    }

    #[test]
    fn regular_courses_have_no_type() {
        assert_eq!(
            resolve_course_type(
                GroupType::Regular,
                SubjectCategory::Elective,
                Some(CourseType::Lk)
            ),
            Ok(None)
        );
    }

    #[test]
    fn zusatzkurs_subjects_force_zk_on_their_courses() {
        assert_eq!(
            resolve_course_type(GroupType::Abitur, SubjectCategory::Zk, Some(CourseType::Lk)),
            Ok(Some(CourseType::Zk))
        );
    }

    #[test]
    fn abitur_courses_pick_between_gk_and_lk() {
        assert_eq!(
            resolve_course_type(
                GroupType::Abitur,
                SubjectCategory::Mandatory,
                Some(CourseType::Lk)
            ),
            Ok(Some(CourseType::Lk))
        );
        assert_eq!(
            resolve_course_type(GroupType::Abitur, SubjectCategory::Optional, None),
            Ok(Some(CourseType::Gk))
        );
        assert!(
            resolve_course_type(
                GroupType::Abitur,
                SubjectCategory::Mandatory,
                Some(CourseType::Zk)
            )
            .is_err()
        );
    }
}
