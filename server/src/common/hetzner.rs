//! Client for the Hetzner Cloud API, limited to reading the server this
//! deployment runs on. The API token never leaves the server: superadmins only
//! receive the metrics read with it.

use crate::config::HetznerConfig;
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::OnceCell;

const API_BASE: &str = "https://api.hetzner.cloud/v1";

/// One sample of a time series: when it was taken, in Unix seconds, and its
/// value, which is `null` where Hetzner has no number and charts show a gap.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, utoipa::ToSchema)]
pub struct MetricPoint {
    pub timestamp: i64,
    pub value: Option<f64>,
}

/// The server's CPU and network series over one time window. CPU is in
/// percent of one vCPU (so up to 100 per core), bandwidths in bytes per second.
#[derive(Debug, PartialEq)]
pub struct ServerMetrics {
    pub cpu: Vec<MetricPoint>,
    pub network_in: Vec<MetricPoint>,
    pub network_out: Vec<MetricPoint>,
}

/// The failures an admin can fix in the configuration are told apart from
/// the ones that only say Hetzner could not be reached.
#[derive(Debug, thiserror::Error)]
pub enum HetznerError {
    #[error("Hetzner rejected the API token")]
    TokenRejected,
    #[error("Hetzner knows no server with this ID")]
    ServerNotFound,
    #[error(transparent)]
    Http(#[from] reqwest::Error),
}

#[derive(Deserialize)]
struct MetricsResponse {
    metrics: MetricsBody,
}

#[derive(Deserialize)]
struct MetricsBody {
    time_series: HashMap<String, TimeSeries>,
}

/// Hetzner sends every sample as `[unix_timestamp, "value"]`, the value as a
/// string so that it can also be `"NaN"`.
#[derive(Deserialize)]
struct TimeSeries {
    values: Vec<(f64, String)>,
}

#[derive(Deserialize)]
struct ServerResponse {
    server: ServerBody,
}

#[derive(Deserialize)]
struct ServerBody {
    server_type: ServerTypeBody,
}

#[derive(Deserialize)]
struct ServerTypeBody {
    cores: u32,
}

impl From<MetricsResponse> for ServerMetrics {
    fn from(response: MetricsResponse) -> Self {
        let mut series = response.metrics.time_series;
        // A series Hetzner leaves out, e.g. right after the server was
        // created, is simply empty rather than an error.
        let mut take = |name: &str| {
            series
                .remove(name)
                .map(|s| s.values.into_iter().map(to_point).collect())
                .unwrap_or_default()
        };

        Self {
            cpu: take("cpu"),
            network_in: take("network.0.bandwidth.in"),
            network_out: take("network.0.bandwidth.out"),
        }
    }
}

fn to_point((timestamp, value): (f64, String)) -> MetricPoint {
    MetricPoint {
        timestamp: timestamp as i64,
        value: value.parse::<f64>().ok().filter(|v| v.is_finite()),
    }
}

#[derive(Clone)]
pub struct HetznerCloud(Arc<Inner>);

struct Inner {
    http: Client,
    api_token: String,
    server_id: u64,
    cores: OnceCell<u32>,
}

impl HetznerCloud {
    pub fn new(http: Client, config: &HetznerConfig) -> Self {
        Self(Arc::new(Inner {
            http,
            api_token: config.api_token.clone(),
            server_id: config.server_id,
            cores: OnceCell::new(),
        }))
    }

    /// The server's vCPU count. Looked up once per process: Hetzner only
    /// rescales a server while it is powered off, which restarts this process
    /// as well, so the count can never go stale.
    pub async fn server_cores(&self) -> Result<u32, HetznerError> {
        self.0
            .cores
            .get_or_try_init(|| async {
                let response: ServerResponse = self
                    .fetch(self.get(&format!("/servers/{}", self.0.server_id)))
                    .await?;
                Ok(response.server.server_type.cores)
            })
            .await
            .copied()
    }

    /// CPU and network metrics between `start` and `end`, one sample
    /// every `step`.
    pub async fn server_metrics(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        step: Duration,
    ) -> Result<ServerMetrics, HetznerError> {
        let start = start.to_rfc3339_opts(SecondsFormat::Secs, true);
        let end = end.to_rfc3339_opts(SecondsFormat::Secs, true);
        let step = step.as_secs().max(1).to_string();

        let request = self
            .get(&format!("/servers/{}/metrics", self.0.server_id))
            .query(&[
                ("type", "cpu"),
                ("type", "network"),
                ("start", start.as_str()),
                ("end", end.as_str()),
                ("step", step.as_str()),
            ]);
        let response: MetricsResponse = self.fetch(request).await?;

        Ok(response.into())
    }

    async fn fetch<T: DeserializeOwned>(&self, request: RequestBuilder) -> Result<T, HetznerError> {
        let response = request.send().await?;
        match response.status() {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(HetznerError::TokenRejected),
            StatusCode::NOT_FOUND => Err(HetznerError::ServerNotFound),
            _ => Ok(response.error_for_status()?.json().await?),
        }
    }

    fn get(&self, path: &str) -> RequestBuilder {
        self.0
            .http
            .get(format!("{API_BASE}{path}"))
            .bearer_auth(&self.0.api_token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn point(timestamp: i64, value: Option<f64>) -> MetricPoint {
        MetricPoint { timestamp, value }
    }

    #[test]
    fn maps_hetzner_series_and_turns_non_numbers_into_gaps() {
        let response: MetricsResponse = serde_json::from_str(
            r#"{
                "metrics": {
                    "start": "2026-10-06T10:00:00Z",
                    "end": "2026-10-06T10:01:00Z",
                    "step": 30,
                    "time_series": {
                        "cpu": { "values": [[1791280800.0, "37.5"], [1791280830.0, "NaN"]] },
                        "network.0.bandwidth.in": { "values": [[1791280800.0, "12"]] },
                        "network.0.bandwidth.out": { "values": [[1791280800.0, "2048.25"]] },
                        "network.0.pps.out": { "values": [[1791280800.0, "9"]] }
                    }
                }
            }"#,
        )
        .unwrap();

        assert_eq!(
            ServerMetrics::from(response),
            ServerMetrics {
                cpu: vec![point(1_791_280_800, Some(37.5)), point(1_791_280_830, None),],
                network_in: vec![point(1_791_280_800, Some(12.0))],
                network_out: vec![point(1_791_280_800, Some(2048.25))],
            }
        );
    }
}
