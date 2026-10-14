use flate2::read::GzDecoder;
use std::{
    fs::{self},
    io::Write,
    path::Path,
};
use tar::Archive;
use tempfile::NamedTempFile;
use tracing::info;

pub async fn download_and_extract_db(
    license_key: &str,
    target_path: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let target_path_obj = Path::new(target_path);

    if let Some(parent) = target_path_obj.parent() {
        fs::create_dir_all(parent)?;
    }

    let parent_dir = target_path_obj.parent().unwrap_or_else(|| Path::new("."));

    info!("Using MaxMind license key for download...");

    let url = format!(
        "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key={}&suffix=tar.gz",
        license_key
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()?;

    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download from MaxMind: HTTP {}",
            response.status()
        )
        .into());
    }

    let bytes = response.bytes().await?;
    info!(
        "Downloaded official MaxMind tar.gz file. Size: {} bytes. Extracting in background thread...",
        bytes.len()
    );

    let parent_dir_buf = parent_dir.to_path_buf();

    let target_path_string = target_path.to_string();

    tokio::task::spawn_blocking(
        move || -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            let mut temp_file = NamedTempFile::new_in(&parent_dir_buf)?;
            let tar_gz = std::io::Cursor::new(bytes);
            let tar = GzDecoder::new(tar_gz);
            let mut archive = Archive::new(tar);
            let mut found = false;

            for entry_result in archive.entries()? {
                let mut entry = entry_result?;
                let path = entry.path()?;
                if path.to_string_lossy().ends_with("GeoLite2-City.mmdb") {
                    info!("Found GeoLite2-City.mmdb in archive at {:?}", path);

                    std::io::copy(&mut entry, &mut temp_file)?;

                    found = true;

                    break;
                }
            }

            if !found {
                return Err(
                    "Could not find GeoLite2-City.mmdb in the downloaded MaxMind archive.".into(),
                );
            }

            temp_file.flush()?;
            temp_file.persist(&target_path_string)?;
            Ok(())
        },
    )
    .await??;

    info!(
        "Database successfully written and persisted to {}",
        target_path
    );
    Ok(())
}
