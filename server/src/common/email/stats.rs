//! What Resend reports about the emails this deployment sent. The reads share
//! the sending client and with it its rate limiter, so looking at the numbers
//! can never push a sign-in code over Resend's request limit.

use super::EmailService;
use chrono::{DateTime, Days, NaiveDate, NaiveTime, SecondsFormat, Utc};
use resend_rs::types::{EmailMetrics, GetEmailMetricsOptions, Metric};
use std::collections::HashMap;

/// The failures an admin can fix in the configuration are told apart from
/// the ones that only say Resend could not be reached.
#[derive(Debug, thiserror::Error)]
pub enum EmailStatsError {
    #[error("no Resend API key is configured")]
    NotConfigured,
    /// Reading metrics and usage needs a full access key; one restricted to
    /// sending is refused.
    #[error("Resend refused the API key")]
    KeyRejected,
    #[error(transparent)]
    Resend(resend_rs::Error),
}

impl From<resend_rs::Error> for EmailStatsError {
    fn from(error: resend_rs::Error) -> Self {
        const UNAUTHORIZED: u16 = 401;
        const FORBIDDEN: u16 = 403;

        match &error {
            resend_rs::Error::Resend(response)
                if matches!(response.status_code, UNAUTHORIZED | FORBIDDEN) =>
            {
                Self::KeyRejected
            }
            _ => Self::Resend(error),
        }
    }
}

/// Emails sent on one UTC day.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DailySent {
    pub day: NaiveDate,
    pub sent: u64,
}

/// What became of the emails sent over a range of days. An email still on
/// its way counts as sent but none of the outcomes yet.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DeliveryOutcomes {
    pub delivered: u64,
    pub bounced: u64,
    /// Refused before delivery was tried, including recipients Resend
    /// suppresses after an earlier bounce or complaint.
    pub failed: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailActivity {
    /// Oldest first, with every day of the range present.
    pub days: Vec<DailySent>,
    pub outcomes: DeliveryOutcomes,
}

/// Emails sent in the current billing month against the plan's quota.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailQuota {
    pub used: u32,
    /// `None` on plans without a monthly limit.
    pub limit: Option<u32>,
    pub resets_at: String,
}

const METRICS: [Metric; 5] = [
    Metric::Sent,
    Metric::Delivered,
    Metric::Bounced,
    Metric::Failed,
    Metric::Suppressed,
];

impl EmailService {
    /// Daily sent counts and delivery outcomes for the `days` UTC days up to
    /// and including today.
    pub async fn activity(&self, days: u32) -> Result<EmailActivity, EmailStatsError> {
        let resend = self.resend.as_ref().ok_or(EmailStatsError::NotConfigured)?;

        let now = Utc::now();
        let first_day = now.date_naive() - Days::new(u64::from(days.saturating_sub(1)));
        let start = first_day.and_time(NaiveTime::MIN).and_utc();

        let options = GetEmailMetricsOptions::default()
            .with_start_date(&iso(start))
            .with_end_date(&iso(now))
            .with_timezone("UTC")
            .with_period_dimension()
            .with_metrics(METRICS);
        let metrics = resend.emails.metrics(options).await?;

        Ok(EmailActivity::from_metrics(&metrics, first_day, days))
    }

    pub async fn monthly_quota(&self) -> Result<EmailQuota, EmailStatsError> {
        let resend = self.resend.as_ref().ok_or(EmailStatsError::NotConfigured)?;
        let monthly = resend.usage.get().await?.emails.monthly;

        Ok(EmailQuota {
            used: monthly.used,
            limit: monthly.limit,
            resets_at: monthly.resets_at,
        })
    }
}

fn iso(time: DateTime<Utc>) -> String {
    time.to_rfc3339_opts(SecondsFormat::Secs, true)
}

impl EmailActivity {
    fn from_metrics(metrics: &EmailMetrics, first_day: NaiveDate, days: u32) -> Self {
        let mut sent_per_day: HashMap<NaiveDate, u64> = HashMap::new();
        for row in metrics.data.iter().flatten() {
            let Some(day) = row.period.as_deref().and_then(period_day) else {
                continue;
            };
            *sent_per_day.entry(day).or_default() += count(&row.metrics, Metric::Sent);
        }

        let days = first_day
            .iter_days()
            .take(days as usize)
            .map(|day| DailySent {
                day,
                sent: sent_per_day.get(&day).copied().unwrap_or_default(),
            })
            .collect();

        let totals = &metrics.totals;
        Self {
            days,
            outcomes: DeliveryOutcomes {
                delivered: count(totals, Metric::Delivered),
                bounced: count(totals, Metric::Bounced),
                failed: count(totals, Metric::Failed) + count(totals, Metric::Suppressed),
            },
        }
    }
}

/// A daily period is a date, but its first ten characters are one in any
/// datetime form as well.
fn period_day(period: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(period.get(..10)?, "%Y-%m-%d").ok()
}

/// Resend sends counts as JSON numbers, which arrive as floats.
fn count(values: &HashMap<String, f64>, metric: Metric) -> u64 {
    values
        .get(metric.as_str())
        .filter(|value| value.is_finite() && **value > 0.0)
        .map_or(0, |value| value.round() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metrics(json: serde_json::Value) -> EmailMetrics {
        serde_json::from_value(json).expect("valid metrics response")
    }

    #[test]
    fn fills_every_day_and_reads_the_outcomes_from_the_totals() {
        let response = metrics(serde_json::json!({
            "object": "metrics",
            "start_date": "2026-10-10T00:00:00.000Z",
            "end_date": "2026-10-12T12:00:00.000Z",
            "metrics": ["sent", "delivered", "bounced", "failed", "suppressed"],
            "dimensions": ["period"],
            "granularity": "daily",
            "totals": { "sent": 9, "delivered": 6, "bounced": 1, "failed": 1, "suppressed": 1 },
            "data": [
                { "period": "2026-10-10", "sent": 4 },
                { "period": "2026-10-12T00:00:00.000Z", "sent": 5 }
            ]
        }));
        let first_day = NaiveDate::from_ymd_opt(2026, 10, 10).unwrap();

        let activity = EmailActivity::from_metrics(&response, first_day, 3);

        let sent: Vec<u64> = activity.days.iter().map(|d| d.sent).collect();
        assert_eq!(sent, [4, 0, 5]);
        assert_eq!(activity.days[2].day, first_day + Days::new(2));
        assert_eq!(
            activity.outcomes,
            DeliveryOutcomes {
                delivered: 6,
                bounced: 1,
                failed: 2,
            }
        );
    }

    #[test]
    fn ignores_rows_outside_the_range_or_without_a_period() {
        let response = metrics(serde_json::json!({
            "object": "metrics",
            "start_date": "2026-10-10T00:00:00.000Z",
            "end_date": "2026-10-10T12:00:00.000Z",
            "metrics": ["sent"],
            "dimensions": ["period"],
            "granularity": "daily",
            "totals": {},
            "data": [
                { "period": "2026-10-09", "sent": 7 },
                { "period": "garbage", "sent": 7 },
                { "sent": 7 }
            ]
        }));
        let first_day = NaiveDate::from_ymd_opt(2026, 10, 10).unwrap();

        let activity = EmailActivity::from_metrics(&response, first_day, 1);

        assert_eq!(
            activity.days,
            [DailySent {
                day: first_day,
                sent: 0
            }]
        );
        assert_eq!(activity.outcomes, DeliveryOutcomes::default());
    }
}
