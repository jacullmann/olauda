use super::event::{CHANNEL, Notice};
use sqlx::postgres::PgListener;
use std::time::Duration;
use tokio::sync::broadcast;
use tokio_util::sync::{CancellationToken, WaitForCancellationFuture};

/// How far a slow stream may fall behind before it has to resync instead.
const BACKLOG: usize = 1024;

const RECONNECT_DELAY: Duration = Duration::from_secs(5);

/// Hands every notice this instance receives to the open event streams.
#[derive(Clone)]
pub struct Hub {
    notices: broadcast::Sender<Notice>,
    closing: CancellationToken,
}

impl Default for Hub {
    fn default() -> Self {
        Self {
            notices: broadcast::Sender::new(BACKLOG),
            closing: CancellationToken::new(),
        }
    }
}

impl Hub {
    pub fn subscribe(&self) -> broadcast::Receiver<Notice> {
        self.notices.subscribe()
    }

    /// Resolves once the server shuts down.
    pub fn closing(&self) -> WaitForCancellationFuture<'_> {
        self.closing.cancelled()
    }

    /// Ends every stream. They never finish on their own, so a graceful
    /// shutdown would otherwise wait on them forever.
    pub fn close(&self) {
        self.closing.cancel();
    }

    /// Relays the notices of every instance, this one included, until the
    /// server shuts down.
    pub fn spawn_listener(&self, database_url: String) {
        let hub = self.clone();
        tokio::spawn(async move {
            tokio::select! {
                () = hub.closing() => {}
                () = hub.listen(&database_url) => {}
            }
        });
    }

    async fn listen(&self, database_url: &str) {
        let mut reconnecting = false;
        loop {
            if let Err(err) = self.relay(database_url, reconnecting).await {
                tracing::error!("Realtime listener failed: {err}");
            }
            reconnecting = true;
            tokio::time::sleep(RECONNECT_DELAY).await;
        }
    }

    async fn relay(&self, database_url: &str, reconnecting: bool) -> Result<(), sqlx::Error> {
        // Its own connection: a pooled one would stay checked out for good.
        let mut listener = PgListener::connect(database_url).await?;
        listener.listen(CHANNEL).await?;

        // Whatever was published while no connection listened is gone.
        if reconnecting {
            self.send(Notice::resync());
        }

        loop {
            match listener.try_recv().await? {
                Some(notification) => match serde_json::from_str(notification.payload()) {
                    Ok(notice) => self.send(notice),
                    Err(err) => tracing::error!("Unreadable realtime notice: {err}"),
                },
                None => {
                    tracing::warn!("Realtime listener lost its connection and reconnected");
                    self.send(Notice::resync());
                }
            }
        }
    }

    fn send(&self, notice: Notice) {
        // Fails only while no stream is open, when nobody needs the notice.
        let _ = self.notices.send(notice);
    }
}
