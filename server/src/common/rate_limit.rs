//! Per-client rate limits for the routes that check a secret (password, code or
//! OAuth round trip), that create content or that send email.
//!
//! Schools reach the internet through one shared public IP, so a whole class
//! signing in at the start of a lesson looks like a single client. The burst
//! therefore covers a class, while the refill still caps sustained guessing.

use crate::error::{ErrorCode, too_many_requests};
use axum::{body::Body, http::Request, response::Response};
use governor::{clock::QuantaInstant, middleware::NoOpMiddleware};
use std::{
    net::{IpAddr, Ipv6Addr},
    sync::Arc,
    time::Duration,
};
use tower_governor::{
    GovernorError, GovernorLayer,
    governor::{GovernorConfigBuilder, SharedRateLimiter},
    key_extractor::{KeyExtractor, SmartIpKeyExtractor},
};

type Middleware = NoOpMiddleware<QuantaInstant>;

pub type ClientRateLimit = GovernorLayer<ClientNetwork, Middleware, Body>;

/// How often limiters forget clients whose quota has fully replenished.
/// Without it, every address ever seen would keep an entry for good.
const PRUNE_INTERVAL: Duration = Duration::from_secs(60);

/// The prefix a single IPv6 subscriber is handed at minimum. Keying on whole
/// addresses would let any client rotate through 2^64 of them at will.
const IPV6_CLIENT_PREFIX_LEN: u32 = 64;

/// Keys limits by the network a request comes from: an IPv4 address, or the
/// /64 an IPv6 address belongs to. The address itself is read as by
/// [`SmartIpKeyExtractor`], so it is only as trustworthy as the reverse proxy
/// that sets the forwarding headers.
#[derive(Debug, Clone, Copy)]
pub struct ClientNetwork;

impl KeyExtractor for ClientNetwork {
    type Key = IpAddr;

    fn extract<T>(&self, req: &Request<T>) -> Result<Self::Key, GovernorError> {
        SmartIpKeyExtractor.extract(req).map(client_network)
    }
}

fn client_network(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V4(_) => ip,
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => {
                let mask = u128::MAX << (Ipv6Addr::BITS - IPV6_CLIENT_PREFIX_LEN);
                IpAddr::V6(Ipv6Addr::from_bits(v6.to_bits() & mask))
            }
        },
    }
}

/// Allows `burst` requests at once per client and refills one request every
/// `replenish_every`.
pub fn per_client(burst: u32, replenish_every: Duration) -> ClientRateLimit {
    let config = GovernorConfigBuilder::default()
        .burst_size(burst)
        .period(replenish_every)
        .key_extractor(ClientNetwork)
        .finish()
        .expect("rate limits use a non-zero burst and period");

    prune_idle_clients(config.limiter());

    GovernorLayer::new(config).error_handler(json_error)
}

/// Answers like every other API error, as JSON with a code, so the client can
/// tell the user in their language to wait instead of showing a raw string.
fn json_error(error: GovernorError) -> Response {
    match error {
        GovernorError::TooManyRequests { wait_time, .. } => too_many_requests(
            "Too many requests. Please try again later.".to_owned(),
            ErrorCode::RateLimited,
            i64::try_from(wait_time).unwrap_or(i64::MAX),
        ),
        other => other.into(),
    }
}

/// Caps the whole API per client at 400 requests per second (governor takes
/// the interval per request, not a rate), well above what a school NAT
/// produces, so only floods are cut off.
pub fn global() -> ClientRateLimit {
    per_client(600, Duration::from_secs(1) / 400)
}

/// Every stored file passes through the upload routes, so this bounds storage
/// abuse even by clients that never attach their uploads to anything. The
/// burst covers a class sharing photos at once.
pub fn uploads() -> ClientRateLimit {
    per_client(60, Duration::from_secs(2))
}

/// For routes that email an address the caller names. Registration has no
/// fixed recipient a per-address limit could hold on to, so this is what
/// bounds how much mail one client can make us send. The burst lets a class
/// sign up together; the refill allows about 30 emails an hour after that.
pub fn outgoing_mail() -> ClientRateLimit {
    per_client(30, Duration::from_secs(2 * 60))
}

/// Holds the limiter weakly, so the task ends along with its layer.
fn prune_idle_clients(limiter: &SharedRateLimiter<IpAddr, Middleware>) {
    let limiter = Arc::downgrade(limiter);

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(PRUNE_INTERVAL);
        loop {
            interval.tick().await;
            let Some(limiter) = limiter.upgrade() else {
                break;
            };
            limiter.retain_recent();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn network(raw: &str) -> IpAddr {
        client_network(raw.parse().unwrap())
    }

    #[test]
    fn ipv4_clients_are_keyed_by_their_address() {
        assert_eq!(network("203.0.113.7"), network("203.0.113.7"));
        assert_ne!(network("203.0.113.7"), network("203.0.113.8"));
    }

    #[test]
    fn ipv6_clients_are_keyed_by_their_64_prefix() {
        assert_eq!(
            network("2001:db8:1:2:aaaa:bbbb:cccc:dddd"),
            "2001:db8:1:2::".parse::<IpAddr>().unwrap()
        );
        assert_eq!(network("2001:db8:1:2::1"), network("2001:db8:1:2:ffff::9"));
        assert_ne!(network("2001:db8:1:2::1"), network("2001:db8:1:3::1"));
    }

    #[test]
    fn ipv4_mapped_addresses_count_as_ipv4() {
        assert_eq!(network("::ffff:203.0.113.7"), network("203.0.113.7"));
    }
}
