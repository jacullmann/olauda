use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::IpAddr;
use uuid::Uuid;

use crate::{common::pagination::SortOrder, security_log::Outcome};

/// Which log an entry comes from: the security audit log or the activity log.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum EventSource {
    Security,
    Activity,
}

impl EventSource {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Security => "security",
            Self::Activity => "activity",
        }
    }
}

/// The position of an entry in the log, from which the next page goes on.
/// Clients get it as an opaque token and only ever hand it back, so the
/// position can change shape without breaking them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(into = "String", try_from = "String")]
pub struct EventCursor {
    pub created_at: DateTime<Utc>,
    pub id: Uuid,
}

impl From<EventCursor> for String {
    fn from(cursor: EventCursor) -> Self {
        let raw = format!("{}_{}", cursor.created_at.timestamp_micros(), cursor.id);
        URL_SAFE_NO_PAD.encode(raw)
    }
}

impl TryFrom<String> for EventCursor {
    type Error = &'static str;

    fn try_from(token: String) -> Result<Self, Self::Error> {
        const INVALID: &str = "invalid cursor";

        let raw = URL_SAFE_NO_PAD.decode(token).map_err(|_| INVALID)?;
        let raw = std::str::from_utf8(&raw).map_err(|_| INVALID)?;
        let (micros, id) = raw.split_once('_').ok_or(INVALID)?;

        Ok(Self {
            created_at: micros
                .parse()
                .ok()
                .and_then(DateTime::from_timestamp_micros)
                .ok_or(INVALID)?,
            id: id.parse().map_err(|_| INVALID)?,
        })
    }
}

/// Narrows the log down; every filter left out matches everything. Address,
/// outcome and group are recorded for security events only, so filtering by
/// any of them leaves out the activity log.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogQuery {
    /// Entries about this account as well as those it caused.
    pub user_id: Option<Uuid>,
    pub source: Option<EventSource>,
    /// The part of a type before its first colon, such as `auth`.
    pub category: Option<String>,
    pub r#type: Option<String>,
    pub outcome: Option<Outcome>,
    pub ip: Option<IpAddr>,
    pub group_id: Option<Uuid>,
    /// Inclusive.
    pub from: Option<DateTime<Utc>>,
    /// Exclusive.
    pub to: Option<DateTime<Utc>>,
    pub search: Option<String>,
    #[serde(default)]
    pub order: SortOrder,
    /// Where the previous page ended; left out for the first page.
    pub cursor: Option<EventCursor>,
}

impl EventLogQuery {
    pub fn category(&self) -> Option<&str> {
        non_blank(self.category.as_deref())
    }

    pub fn event_type(&self) -> Option<&str> {
        non_blank(self.r#type.as_deref())
    }
}

fn non_blank(raw: Option<&str>) -> Option<&str> {
    raw.map(str::trim).filter(|s| !s.is_empty())
}

/// An entry of either log with the names of the accounts and group it refers
/// to, as far as they still exist: security events outlive them.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogEntryDto {
    pub id: Uuid,
    pub source: EventSource,
    pub r#type: String,
    /// Security events only.
    pub outcome: Option<Outcome>,
    pub user_id: Option<Uuid>,
    pub user_email: Option<String>,
    pub actor_id: Option<Uuid>,
    pub actor_email: Option<String>,
    pub group_id: Option<Uuid>,
    pub group_name: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

impl EventLogEntryDto {
    pub const fn cursor(&self) -> EventCursor {
        EventCursor {
            created_at: self.created_at,
            id: self.id,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogPage {
    pub items: Vec<EventLogEntryDto>,
    /// Absent once the log is exhausted.
    pub next_cursor: Option<EventCursor>,
    /// How many entries match in all, counted for the first page only, so
    /// scrolling further costs no count of the whole log.
    pub total: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cursor_survives_a_round_trip() {
        let cursor = EventCursor {
            created_at: DateTime::from_timestamp_micros(1_760_000_000_123_456).unwrap(),
            id: Uuid::new_v4(),
        };

        let token = String::from(cursor);
        assert!(
            token
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        );
        assert_eq!(EventCursor::try_from(token), Ok(cursor));
    }

    #[test]
    fn rejects_a_tampered_cursor() {
        for token in ["", "not base64!", &URL_SAFE_NO_PAD.encode("12_not-a-uuid")] {
            assert!(EventCursor::try_from(token.to_owned()).is_err(), "{token}");
        }
    }

    #[test]
    fn filters_skip_blanks_and_reject_unknown_values() {
        let parse = |raw: Value| serde_json::from_value::<EventLogQuery>(raw);

        let query = parse(serde_json::json!({
            "type": " ",
            "category": "auth",
            "source": "security",
            "outcome": "failure",
            "ip": "10.0.0.1",
        }))
        .expect("valid filters");
        assert_eq!(query.event_type(), None);
        assert_eq!(query.category(), Some("auth"));
        assert_eq!(query.source, Some(EventSource::Security));
        assert_eq!(query.outcome, Some(Outcome::Failure));
        assert_eq!(query.ip, Some(IpAddr::from([10, 0, 0, 1])));

        assert!(parse(serde_json::json!({ "outcome": "maybe" })).is_err());
        assert!(parse(serde_json::json!({ "source": "mail" })).is_err());
        assert!(parse(serde_json::json!({ "ip": "not-an-ip" })).is_err());
    }
}
