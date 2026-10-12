use maxminddb::{geoip2, Reader};
use serde::Serialize;
use std::{
    net::IpAddr,
    sync::{Arc, RwLock},
};
use tracing::{error, info};

#[derive(Debug, Serialize, Clone)]
pub struct LookupResponse {
    pub ip: String,
    pub country: Option<String>,
    pub country_code: Option<String>,
    pub city: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timezone: Option<String>,
    pub continent: Option<String>,
    pub continent_code: Option<String>,
    pub postal_code: Option<String>,
    pub is_local: bool,
}

#[derive(Clone)]
pub struct GeoIpState {
    reader: Arc<RwLock<Option<Reader<Vec<u8>>>>>,
}

impl GeoIpState {
    pub fn new() -> Self {
        Self {
            reader: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn load_database(
        &self,
        path: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!("Loading GeoIP database from {}", path);
        let data = tokio::fs::read(path).await?;
        let reader = Reader::from_source(data)?;

        {
            let mut writer = self.reader.write().map_err(|e| {
                error!("Failed to acquire write lock for database reload: {}", e);
                "lock error"
            })?;
            *writer = Some(reader);
        }

        info!("GeoIP database successfully loaded and hot-swapped!");
        Ok(())
    }

    pub fn is_loaded(&self) -> bool {
        self.reader.read().map(|r| r.is_some()).unwrap_or(false)
    }

    pub fn lookup(&self, ip: IpAddr) -> Result<LookupResponse, String> {
        // Intercept loopback and private/local IP addresses
        if ip.is_loopback() || is_private_ip(ip) {
            return Ok(LookupResponse {
                ip: ip.to_string(),
                country: Some("Localhost".to_string()),
                country_code: Some("LO".to_string()),
                city: Some("Localhost".to_string()),
                latitude: Some(0.0),
                longitude: Some(0.0),
                timezone: Some("UTC".to_string()),
                continent: Some("Local".to_string()),
                continent_code: Some("LO".to_string()),
                postal_code: None,
                is_local: true,
            });
        }

        let reader_lock = self
            .reader
            .read()
            .map_err(|e| format!("Failed to acquire read lock for lookup: {}", e))?;

        let reader = reader_lock
            .as_ref()
            .ok_or_else(|| "GeoIP database is not loaded yet".to_string())?;

        let lookup_result = reader
            .lookup(ip)
            .map_err(|e| format!("IP lookup failed: {}", e))?;

        let city_data: geoip2::City<'_> = lookup_result
            .decode()
            .map_err(|e| format!("Failed to decode GeoIP data: {}", e))?
            .ok_or_else(|| "IP address not found in database".to_string())?;

        let country = city_data.country.names.english.map(|s| s.to_string());
        let country_code = city_data.country.iso_code.map(|s| s.to_string());
        let city = city_data.city.names.english.map(|s| s.to_string());
        let latitude = city_data.location.latitude;
        let longitude = city_data.location.longitude;
        let timezone = city_data.location.time_zone.map(|s| s.to_string());
        let continent = city_data.continent.names.english.map(|s| s.to_string());
        let continent_code = city_data.continent.code.map(|s| s.to_string());
        let postal_code = city_data.postal.code.map(|s| s.to_string());

        Ok(LookupResponse {
            ip: ip.to_string(),
            country,
            country_code,
            city,
            latitude,
            longitude,
            timezone,
            continent,
            continent_code,
            postal_code,
            is_local: false,
        })
    }
}

pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => ipv4.is_private(),
        IpAddr::V6(ipv6) => {
            let segments = ipv6.segments();
            let first_byte = (segments[0] >> 8) as u8;
            first_byte == 0xfc || first_byte == 0xfd || (segments[0] & 0xffc0) == 0xfe80
        }
    }
}
