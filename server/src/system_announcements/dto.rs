use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    announcements::dto::CONTENT_MAX_CHARS,
    common::text::DisplayText,
    error::{AppError, AppResult},
};

/// A running announcement a user has yet to read.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SystemAnnouncementDto {
    pub id: Uuid,
    pub content: String,
    pub important: bool,
    pub published_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SystemAnnouncementStatus {
    Scheduled,
    Active,
}

impl SystemAnnouncementStatus {
    pub const fn from_scheduled(scheduled: bool) -> Self {
        if scheduled {
            Self::Scheduled
        } else {
            Self::Active
        }
    }
}

/// An announcement as superadmins manage it. Ended ones are never listed:
/// they are gone for everyone, and the cleanup deletes them.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AdminSystemAnnouncementDto {
    pub id: Uuid,
    pub content: String,
    pub important: bool,
    pub status: SystemAnnouncementStatus,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
    pub author_email: Option<String>,
    pub read_count: i64,
}

/// The body for both posting and rescheduling an announcement.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveSystemAnnouncementDto {
    pub content: String,
    #[serde(default)]
    pub important: bool,
    /// Omitted to publish right away.
    pub starts_at: Option<DateTime<Utc>>,
    /// Omitted to show the announcement until it is deleted.
    pub ends_at: Option<DateTime<Utc>>,
}

/// A validated announcement whose schedule is consistent with `now`.
#[derive(Debug)]
pub struct SystemAnnouncementInput {
    pub content: DisplayText,
    pub important: bool,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
}

impl SaveSystemAnnouncementDto {
    /// A start that has already passed means right away, so a form that was
    /// left open for a while still publishes instead of failing.
    pub fn parse(self, now: DateTime<Utc>) -> AppResult<SystemAnnouncementInput> {
        let content = DisplayText::parse(&self.content, CONTENT_MAX_CHARS, "content")?;
        let starts_at = self.starts_at.map_or(now, |start| start.max(now));

        if self.ends_at.is_some_and(|end| end <= starts_at) {
            return Err(AppError::Validation(vec!["endsAt".to_owned()]));
        }

        Ok(SystemAnnouncementInput {
            content,
            important: self.important,
            starts_at,
            ends_at: self.ends_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;

    fn dto(
        starts_at: Option<DateTime<Utc>>,
        ends_at: Option<DateTime<Utc>>,
    ) -> SaveSystemAnnouncementDto {
        SaveSystemAnnouncementDto {
            content: "Wartung am Samstag".into(),
            important: false,
            starts_at,
            ends_at,
        }
    }

    fn invalid_fields(result: AppResult<SystemAnnouncementInput>) -> Vec<String> {
        match result {
            Err(AppError::Validation(fields)) => fields,
            other => panic!("expected a validation error, got {other:?}"),
        }
    }

    #[test]
    fn starts_now_when_omitted() {
        let now = Utc::now();
        let input = dto(None, None).parse(now).unwrap();
        assert_eq!(input.starts_at, now);
        assert_eq!(input.ends_at, None);
    }

    #[test]
    fn past_start_is_moved_to_now() {
        let now = Utc::now();
        let input = dto(Some(now - TimeDelta::hours(1)), None)
            .parse(now)
            .unwrap();
        assert_eq!(input.starts_at, now);
    }

    #[test]
    fn future_start_is_kept() {
        let now = Utc::now();
        let start = now + TimeDelta::days(2);
        let input = dto(Some(start), None).parse(now).unwrap();
        assert_eq!(input.starts_at, start);
    }

    #[test]
    fn end_must_follow_start() {
        let now = Utc::now();
        let start = now + TimeDelta::days(2);
        assert_eq!(
            invalid_fields(dto(Some(start), Some(start)).parse(now)),
            ["endsAt"]
        );
        assert!(
            dto(Some(start), Some(start + TimeDelta::minutes(1)))
                .parse(now)
                .is_ok()
        );
    }

    #[test]
    fn end_in_the_past_is_rejected() {
        let now = Utc::now();
        assert_eq!(
            invalid_fields(dto(None, Some(now - TimeDelta::minutes(1))).parse(now)),
            ["endsAt"]
        );
    }

    #[test]
    fn blank_content_is_rejected() {
        let mut blank = dto(None, None);
        blank.content = "   ".into();
        assert_eq!(invalid_fields(blank.parse(Utc::now())), ["content"]);
    }
}
