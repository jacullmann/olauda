use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum ItemType {
    Homework,
    Dalton,
    Exam,
}

impl ItemType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Homework => "homework",
            Self::Dalton => "dalton",
            Self::Exam => "exam",
        }
    }

    pub const fn image_quota(self) -> ImageQuota {
        match self {
            Self::Homework | Self::Dalton => ImageQuota {
                per_uploader: 8,
                total: 12,
            },
            Self::Exam => ImageQuota {
                per_uploader: 12,
                total: 18,
            },
        }
    }
}

/// How many images a task may hold. The per-uploader share keeps a single
/// member from filling the whole task, so others can still add theirs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ImageQuota {
    pub per_uploader: usize,
    pub total: usize,
}

impl ImageQuota {
    /// `own` and `total` count the images the task already holds.
    pub fn ensure_room_for(self, adding: usize, own: usize, total: usize) -> AppResult<()> {
        if own + adding > self.per_uploader {
            return Err(AppError::bad_request(format!(
                "Maximum of {} images per member and task reached.",
                self.per_uploader
            )));
        }
        if total + adding > self.total {
            return Err(AppError::bad_request(format!(
                "Maximum of {} images per task reached.",
                self.total
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOMEWORK: ImageQuota = ItemType::Homework.image_quota();
    const EXAM: ImageQuota = ItemType::Exam.image_quota();

    #[test]
    fn quotas_match_the_item_type() {
        assert_eq!(ItemType::Dalton.image_quota(), HOMEWORK);
        assert_eq!((HOMEWORK.per_uploader, HOMEWORK.total), (8, 12));
        assert_eq!((EXAM.per_uploader, EXAM.total), (12, 18));
    }

    #[test]
    fn accepts_a_batch_that_exactly_fills_the_quota() {
        assert!(HOMEWORK.ensure_room_for(8, 0, 0).is_ok());
        assert!(HOMEWORK.ensure_room_for(4, 0, 8).is_ok());
        assert!(EXAM.ensure_room_for(12, 0, 6).is_ok());
    }

    #[test]
    fn rejects_exceeding_the_per_uploader_share() {
        assert!(HOMEWORK.ensure_room_for(9, 0, 0).is_err());
        assert!(HOMEWORK.ensure_room_for(1, 8, 8).is_err());
        assert!(EXAM.ensure_room_for(13, 0, 0).is_err());
    }

    #[test]
    fn rejects_exceeding_the_task_total_even_within_own_share() {
        assert!(HOMEWORK.ensure_room_for(1, 0, 12).is_err());
        assert!(HOMEWORK.ensure_room_for(5, 0, 8).is_err());
        assert!(EXAM.ensure_room_for(7, 0, 12).is_err());
    }
}
