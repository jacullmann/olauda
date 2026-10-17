use chrono::{Datelike, NaiveDate, Weekday};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// A school week, named by its Monday. Any other day is rejected while
/// deserializing, so a week can only ever be named one way.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, ToSchema)]
#[serde(try_from = "NaiveDate", into = "NaiveDate")]
pub struct WeekStart(NaiveDate);

impl WeekStart {
    pub const fn monday(self) -> NaiveDate {
        self.0
    }
}

impl TryFrom<NaiveDate> for WeekStart {
    type Error = &'static str;

    fn try_from(date: NaiveDate) -> Result<Self, Self::Error> {
        if date.weekday() == Weekday::Mon {
            Ok(Self(date))
        } else {
            Err("A week starts on a Monday.")
        }
    }
}

impl From<WeekStart> for NaiveDate {
    fn from(week: WeekStart) -> Self {
        week.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_monday_starts_a_week() {
        let monday = NaiveDate::from_ymd_opt(2026, 10, 5).unwrap();
        let tuesday = NaiveDate::from_ymd_opt(2026, 10, 6).unwrap();

        assert_eq!(
            WeekStart::try_from(monday).map(WeekStart::monday),
            Ok(monday)
        );
        assert!(WeekStart::try_from(tuesday).is_err());
        assert!(serde_json::from_str::<WeekStart>(r#""2026-10-06""#).is_err());
        assert_eq!(
            serde_json::to_string(&WeekStart(monday)).unwrap(),
            r#""2026-10-05""#
        );
    }
}
