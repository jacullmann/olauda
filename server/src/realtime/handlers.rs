use super::event::{AccountTopic, Audience, Event, Notice, PlatformTopic};
use crate::{
    auth::session_context::{SessionStatus, session_status},
    common::extractors::AuthUser,
    error::AppResult,
    state::AppState,
};
use axum::{
    extract::State,
    response::sse::{self, KeepAlive, Sse},
};
use chrono::Utc;
use futures_util::{Stream, stream};
use sqlx::PgPool;
use std::collections::HashSet;
use tokio::{
    sync::broadcast::{Receiver, error::RecvError},
    time::Instant,
};
use uuid::Uuid;

/// The signed-in user's live updates as server-sent events. The stream ends
/// when the access token expires, so a revoked session or membership cannot
/// outlive it; the browser then reconnects with a fresh token.
#[utoipa::path(
    get,
    path = "/events",
    tag = "realtime",
    responses((
        status = 200,
        description = "One `Event` per message",
        content_type = "text/event-stream",
        body = Event,
    )),
)]
pub async fn events(
    State(s): State<AppState>,
    user: AuthUser,
) -> AppResult<Sse<impl Stream<Item = Result<sse::Event, axum::Error>>>> {
    // Subscribed first, so no change slips in while the groups are loaded.
    let notices = s.realtime.subscribe();
    let groups = memberships(&s.db, user.user_id).await?;
    let lifetime = (user.expires_at - Utc::now()).to_std().unwrap_or_default();

    let subscription = Subscription {
        state: s,
        notices,
        user,
        groups,
        deadline: Instant::now() + lifetime,
    };

    let events = stream::unfold(subscription, |mut subscription| async move {
        let event = subscription.next().await?;
        Some((sse::Event::default().json_data(event), subscription))
    });

    Ok(Sse::new(events).keep_alive(KeepAlive::default()))
}

struct Subscription {
    state: AppState,
    notices: Receiver<Notice>,
    user: AuthUser,
    /// The groups whose events reach the user, kept current by the
    /// `Groups` events every change of membership sends them.
    groups: HashSet<Uuid>,
    deadline: Instant,
}

impl Subscription {
    /// The next event for the user, or `None` once the stream has to end.
    async fn next(&mut self) -> Option<Event> {
        loop {
            let received = tokio::select! {
                () = self.state.realtime.closing() => return None,
                () = tokio::time::sleep_until(self.deadline) => return None,
                received = self.notices.recv() => received,
            };

            let notice = match received {
                Ok(notice) => notice,
                Err(RecvError::Lagged(_)) => return Some(Event::Resync),
                Err(RecvError::Closed) => return None,
            };

            match self.accept(notice).await {
                Ok(Delivery::Send(event)) => return Some(event),
                Ok(Delivery::Skip) => {}
                Ok(Delivery::End) => return None,
                Err(err) => {
                    tracing::error!("Ending an event stream: {err}");
                    return None;
                }
            }
        }
    }

    /// Whether `notice` is meant for the user, after updating what the stream
    /// knows about them.
    async fn accept(&mut self, notice: Notice) -> AppResult<Delivery> {
        let event = notice.event();
        let for_user = match notice.audience() {
            Audience::Everyone => true,
            Audience::User(user_id) => user_id == self.user.user_id,
            Audience::Members(group_id) => self.groups.contains(&group_id),
        };
        if !for_user {
            return Ok(Delivery::Skip);
        }

        match event {
            Event::Account {
                topic: AccountTopic::Groups,
            } => {
                self.groups = memberships(&self.state.db, self.user.user_id).await?;
            }
            Event::Account {
                topic: AccountTopic::Security,
            }
            | Event::Platform {
                topic: PlatformTopic::Access,
            } => {
                let status =
                    session_status(&self.state.db, self.user.user_id, self.user.session_id).await?;
                // The client learns why when it reconnects.
                if status != SessionStatus::Active {
                    return Ok(Delivery::End);
                }
            }
            _ => {}
        }

        Ok(Delivery::Send(event))
    }
}

enum Delivery {
    Send(Event),
    Skip,
    End,
}

async fn memberships(db: &PgPool, user_id: Uuid) -> AppResult<HashSet<Uuid>> {
    let groups = sqlx::query_scalar!(
        r#"SELECT tenant_id AS "tenant_id!" FROM user_roles
           WHERE user_id = $1 AND tenant_id IS NOT NULL"#,
        user_id
    )
    .fetch_all(db)
    .await?;

    Ok(groups.into_iter().collect())
}
