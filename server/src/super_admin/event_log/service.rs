use super::dto::*;
use crate::{
    common::pagination::{SortOrder, search_params},
    error::AppResult,
    security_log::Outcome,
    state::AppState,
};
use chrono::{DateTime, Utc};
use ipnetwork::IpNetwork;
use sqlx::{PgConnection, PgPool, Postgres, Transaction};
use uuid::Uuid;

const PAGE_SIZE: i64 = 50;

/// The security audit log and the activity log as one timeline, read through
/// the `event_log` view.
///
/// Pages are cut by keyset on `(created_at, id)` rather than by offset: new
/// entries keep arriving at the head of the log, which would shift every
/// offset under a reader scrolling through it, and a keyset stays as fast on
/// the last page as on the first. Each direction has its own query, so both
/// can walk the index instead of sorting every matching entry for each page.
///
/// Every filter is optional (`$n IS NULL OR …`), so a single generic plan
/// would have to serve all of their combinations and ends up scanning both
/// tables in full, about a thousand times slower than walking the index.
/// Postgres moves a prepared statement to a generic plan once it has run a few
/// times, so the log's queries run in transactions that turn this off.
///
/// A search has to look at every entry it does not match. It reads the
/// metadata as text, which also matches its keys, since taking the JSON apart
/// costs several times as much; accounts and groups are matched through their
/// ids, not joined for each entry.
pub struct EventLogService {
    db: PgPool,
}

impl EventLogService {
    pub fn from_state(s: &AppState) -> Self {
        Self { db: s.db.clone() }
    }

    pub async fn page(&self, query: &EventLogQuery) -> AppResult<EventLogPage> {
        let filters = Filters::from(query);
        // One more than a page tells whether another one follows.
        let fetch_limit = PAGE_SIZE + 1;

        let entries = async {
            let mut tx = self.begin_planned_per_run().await?;
            let entries = match query.order {
                SortOrder::Desc => {
                    Self::newest_first(&mut tx, &filters, query.cursor, fetch_limit).await?
                }
                SortOrder::Asc => {
                    Self::oldest_first(&mut tx, &filters, query.cursor, fetch_limit).await?
                }
            };
            tx.commit().await?;
            Ok::<_, sqlx::Error>(entries)
        };
        let total = async {
            if query.cursor.is_some() {
                return Ok(None);
            }
            let mut tx = self.begin_planned_per_run().await?;
            let total = Self::count(&mut tx, &filters).await?;
            tx.commit().await?;
            Ok(Some(total))
        };
        let (mut items, total) = tokio::try_join!(entries, total)?;

        let next_cursor = if items.len() > PAGE_SIZE as usize {
            items.truncate(PAGE_SIZE as usize);
            items.last().map(EventLogEntryDto::cursor)
        } else {
            None
        };

        Ok(EventLogPage {
            items,
            next_cursor,
            total,
        })
    }

    /// A read-only transaction in which every statement is planned for the
    /// parameters it runs with, never from a cached generic plan.
    async fn begin_planned_per_run(&self) -> sqlx::Result<Transaction<'static, Postgres>> {
        let mut tx = self.db.begin_with("BEGIN READ ONLY").await?;
        sqlx::query!("SELECT set_config('plan_cache_mode', 'force_custom_plan', true)")
            .fetch_one(&mut *tx)
            .await?;
        Ok(tx)
    }

    async fn newest_first(
        conn: &mut PgConnection,
        f: &Filters<'_>,
        cursor: Option<EventCursor>,
        limit: i64,
    ) -> sqlx::Result<Vec<EventLogEntryDto>> {
        sqlx::query_as!(
            EventLogEntryDto,
            r#"SELECT l.id AS "id!", l.source AS "source!: EventSource", l.type AS "type!",
                      l.outcome AS "outcome: Outcome",
                      l.user_id, u.email AS "user_email?", l.actor_id, a.email AS "actor_email?",
                      l.group_id, g.name AS "group_name?",
                      host(l.ip_address) AS ip_address, l.user_agent,
                      l.metadata AS "metadata!", l.created_at AS "created_at!"
               FROM event_log l
               LEFT JOIN users u ON u.id = l.user_id
               LEFT JOIN users a ON a.id = l.actor_id
               LEFT JOIN groups g ON g.id = l.group_id
               WHERE ($1::uuid IS NULL OR l.user_id = $1 OR l.actor_id = $1)
                 AND ($2::text IS NULL OR l.source = $2)
                 AND ($3::text IS NULL OR split_part(l.type, ':', 1) = $3)
                 AND ($4::text IS NULL OR l.type = $4)
                 AND ($5::text IS NULL OR l.outcome = $5)
                 AND ($6::inet IS NULL OR l.ip_address = $6)
                 AND ($7::uuid IS NULL OR l.group_id = $7)
                 AND ($8::timestamptz IS NULL OR l.created_at >= $8)
                 AND ($9::timestamptz IS NULL OR l.created_at < $9)
                 AND ($10::text IS NULL
                      OR l.type ILIKE $10 OR host(l.ip_address) ILIKE $10
                      OR l.user_agent ILIKE $10 OR l.metadata::text ILIKE $10
                      OR l.user_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.actor_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.group_id IN (SELECT id FROM groups WHERE name ILIKE $10)
                      OR $11 IN (l.id, l.user_id, l.actor_id, l.group_id))
                 AND ($12::timestamptz IS NULL OR (l.created_at, l.id) < ($12, $13::uuid))
               ORDER BY l.created_at DESC, l.id DESC
               LIMIT $14"#,
            f.user_id,
            f.source,
            f.category,
            f.event_type,
            f.outcome,
            f.ip,
            f.group_id,
            f.from,
            f.to,
            f.pattern.as_deref(),
            f.search_id,
            cursor.map(|c| c.created_at),
            cursor.map(|c| c.id),
            limit,
        )
        .fetch_all(conn)
        .await
    }

    async fn oldest_first(
        conn: &mut PgConnection,
        f: &Filters<'_>,
        cursor: Option<EventCursor>,
        limit: i64,
    ) -> sqlx::Result<Vec<EventLogEntryDto>> {
        sqlx::query_as!(
            EventLogEntryDto,
            r#"SELECT l.id AS "id!", l.source AS "source!: EventSource", l.type AS "type!",
                      l.outcome AS "outcome: Outcome",
                      l.user_id, u.email AS "user_email?", l.actor_id, a.email AS "actor_email?",
                      l.group_id, g.name AS "group_name?",
                      host(l.ip_address) AS ip_address, l.user_agent,
                      l.metadata AS "metadata!", l.created_at AS "created_at!"
               FROM event_log l
               LEFT JOIN users u ON u.id = l.user_id
               LEFT JOIN users a ON a.id = l.actor_id
               LEFT JOIN groups g ON g.id = l.group_id
               WHERE ($1::uuid IS NULL OR l.user_id = $1 OR l.actor_id = $1)
                 AND ($2::text IS NULL OR l.source = $2)
                 AND ($3::text IS NULL OR split_part(l.type, ':', 1) = $3)
                 AND ($4::text IS NULL OR l.type = $4)
                 AND ($5::text IS NULL OR l.outcome = $5)
                 AND ($6::inet IS NULL OR l.ip_address = $6)
                 AND ($7::uuid IS NULL OR l.group_id = $7)
                 AND ($8::timestamptz IS NULL OR l.created_at >= $8)
                 AND ($9::timestamptz IS NULL OR l.created_at < $9)
                 AND ($10::text IS NULL
                      OR l.type ILIKE $10 OR host(l.ip_address) ILIKE $10
                      OR l.user_agent ILIKE $10 OR l.metadata::text ILIKE $10
                      OR l.user_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.actor_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.group_id IN (SELECT id FROM groups WHERE name ILIKE $10)
                      OR $11 IN (l.id, l.user_id, l.actor_id, l.group_id))
                 AND ($12::timestamptz IS NULL OR (l.created_at, l.id) > ($12, $13::uuid))
               ORDER BY l.created_at ASC, l.id ASC
               LIMIT $14"#,
            f.user_id,
            f.source,
            f.category,
            f.event_type,
            f.outcome,
            f.ip,
            f.group_id,
            f.from,
            f.to,
            f.pattern.as_deref(),
            f.search_id,
            cursor.map(|c| c.created_at),
            cursor.map(|c| c.id),
            limit,
        )
        .fetch_all(conn)
        .await
    }

    async fn count(conn: &mut PgConnection, f: &Filters<'_>) -> sqlx::Result<i64> {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!"
               FROM event_log l
               WHERE ($1::uuid IS NULL OR l.user_id = $1 OR l.actor_id = $1)
                 AND ($2::text IS NULL OR l.source = $2)
                 AND ($3::text IS NULL OR split_part(l.type, ':', 1) = $3)
                 AND ($4::text IS NULL OR l.type = $4)
                 AND ($5::text IS NULL OR l.outcome = $5)
                 AND ($6::inet IS NULL OR l.ip_address = $6)
                 AND ($7::uuid IS NULL OR l.group_id = $7)
                 AND ($8::timestamptz IS NULL OR l.created_at >= $8)
                 AND ($9::timestamptz IS NULL OR l.created_at < $9)
                 AND ($10::text IS NULL
                      OR l.type ILIKE $10 OR host(l.ip_address) ILIKE $10
                      OR l.user_agent ILIKE $10 OR l.metadata::text ILIKE $10
                      OR l.user_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.actor_id IN (SELECT id FROM users WHERE email ILIKE $10)
                      OR l.group_id IN (SELECT id FROM groups WHERE name ILIKE $10)
                      OR $11 IN (l.id, l.user_id, l.actor_id, l.group_id))"#,
            f.user_id,
            f.source,
            f.category,
            f.event_type,
            f.outcome,
            f.ip,
            f.group_id,
            f.from,
            f.to,
            f.pattern.as_deref(),
            f.search_id,
        )
        .fetch_one(conn)
        .await
    }
}

/// The query's filters as the SQL binds them.
struct Filters<'a> {
    user_id: Option<Uuid>,
    source: Option<&'static str>,
    category: Option<&'a str>,
    event_type: Option<&'a str>,
    outcome: Option<&'static str>,
    ip: Option<IpNetwork>,
    group_id: Option<Uuid>,
    from: Option<DateTime<Utc>>,
    to: Option<DateTime<Utc>>,
    pattern: Option<String>,
    search_id: Option<Uuid>,
}

impl<'a> From<&'a EventLogQuery> for Filters<'a> {
    fn from(query: &'a EventLogQuery) -> Self {
        let (pattern, search_id) = search_params(query.search.as_deref());

        Self {
            user_id: query.user_id,
            source: query.source.map(EventSource::as_str),
            category: query.category(),
            event_type: query.event_type(),
            outcome: query.outcome.map(Outcome::as_str),
            ip: query.ip.map(IpNetwork::from),
            group_id: query.group_id,
            from: query.from,
            to: query.to,
            pattern,
            search_id,
        }
    }
}
