use super::dto::{
    CourseDto, LessonDto, ScheduleDto, ScheduleSubsQuery, SubjectDto, SubstitutionDto,
};
use crate::{
    common::{group_type::SubjectCategory, school_week::WeekStart},
    error::AppResult,
    state::AppState,
};
use sqlx::{PgPool, types::Json};
use std::collections::HashSet;
use uuid::Uuid;

pub struct ScheduleService {
    db: PgPool,
}

impl ScheduleService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    /// The group's timetable; for a member who personalized it, without the
    /// lessons of courses they do not take.
    pub async fn get_schedule(
        &self,
        tenant_id: Uuid,
        user_id: Option<Uuid>,
    ) -> AppResult<ScheduleDto> {
        let lessons = sqlx::query_as!(
            LessonDto,
            r#"SELECT s.id, s.day, s.slot, s.duration, s.room, s.course_id, s.is_dalton,
                      sub.id AS "subject_id?", sub.name AS "subject_name?",
                      c.name AS "course_name?"
               FROM schedules s
               LEFT JOIN subjects sub ON sub.id = s.subject_id
               LEFT JOIN courses c ON c.id = s.course_id
               WHERE s.tenant_id = $1"#,
            tenant_id
        )
        .fetch_all(&self.db)
        .await?;

        let Some(enrolled) = self.enrolled_courses(tenant_id, user_id).await? else {
            return Ok(ScheduleDto {
                lessons,
                hidden_by_courses: 0,
            });
        };

        let lesson_count = lessons.len();
        let lessons: Vec<LessonDto> = lessons
            .into_iter()
            .filter(|lesson| lesson.course_id.is_none_or(|id| enrolled.contains(&id)))
            .collect();

        Ok(ScheduleDto {
            hidden_by_courses: lesson_count - lessons.len(),
            lessons,
        })
    }

    /// The courses the member takes, or `None` when their timetable shows
    /// every lesson. A lesson bound to a course is only that course's lesson,
    /// which matters most for Abitur groups where nearly every lesson is.
    async fn enrolled_courses(
        &self,
        tenant_id: Uuid,
        user_id: Option<Uuid>,
    ) -> AppResult<Option<HashSet<Uuid>>> {
        let Some(user_id) = user_id else {
            return Ok(None);
        };

        let personalized = sqlx::query!(
            r#"SELECT u.personalized, ur.done_course_setup
               FROM users u
               JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = $2
               WHERE u.id = $1"#,
            user_id,
            tenant_id
        )
        .fetch_optional(&self.db)
        .await?
        .is_some_and(|u| u.personalized && u.done_course_setup);

        if !personalized {
            return Ok(None);
        }

        let courses = sqlx::query_scalar!(
            r#"SELECT course_id FROM user_courses WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(Some(courses.into_iter().collect()))
    }

    pub async fn get_subs(
        &self,
        tenant_id: Uuid,
        weeks: ScheduleSubsQuery,
    ) -> AppResult<Vec<SubstitutionDto>> {
        let subs = sqlx::query!(
            r#"SELECT id, lesson_id, course_id, week_start, day, slot, duration, subject, room,
                      cancelled, created_at
               FROM schedule_subs
               WHERE tenant_id = $1
                 AND ($2::date IS NULL OR week_start >= $2)
                 AND ($3::date IS NULL OR week_start <= $3)
               ORDER BY week_start"#,
            tenant_id,
            weeks.from.map(WeekStart::monday),
            weeks.to.map(WeekStart::monday)
        )
        .fetch_all(&self.db)
        .await?;

        Ok(subs
            .into_iter()
            .map(|s| SubstitutionDto {
                id: s.id,
                lesson_id: s.lesson_id,
                course_id: s.course_id,
                week_start: s.week_start,
                // The column is text, while lessons name their day by number.
                day: s.day.and_then(|day| day.parse().ok()),
                slot: s.slot,
                duration: s.duration,
                subject: s.subject,
                room: s.room,
                cancelled: s.cancelled,
                created_at: s.created_at,
            })
            .collect())
    }

    pub async fn get_subjects(&self, tenant_id: Uuid) -> AppResult<Vec<SubjectDto>> {
        let subjects = sqlx::query!(
            r#"SELECT s.id, s.name, s.category AS "category: SubjectCategory", s.is_dalton,
                      COALESCE(
                          json_agg(json_build_object('id', c.id, 'name', c.name, 'courseType', c.course_type) ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL),
                          '[]'::json
                      ) AS "courses!: Json<Vec<CourseDto>>"
               FROM subjects s
               LEFT JOIN courses c ON c.subject_id = s.id
               WHERE s.tenant_id = $1
               GROUP BY s.id ORDER BY s.name"#,
            tenant_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(subjects
            .into_iter()
            .map(|s| SubjectDto {
                id: s.id,
                name: s.name,
                category: s.category,
                is_dalton: s.is_dalton,
                courses: s.courses.0,
            })
            .collect())
    }
}
