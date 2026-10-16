//! Packs an export into the ZIP the user downloads: `data.json` for Art. 20
//! GDPR and a plain-language notice with the information Art. 15(1) and (2)
//! GDPR require next to the data itself.

use super::dto::DataExport;
use crate::{
    common::locale::Locale,
    error::{AppError, AppResult},
};
use anyhow::Context;
use chrono::{DateTime, Datelike, Timelike, Utc};
use serde_json::Value;
use std::io::{Cursor, Write};
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

const NOTICE_DE: &str = include_str!("notice_de.txt");
const NOTICE_EN: &str = include_str!("notice_en.txt");
const DATA_FILE: &str = "data.json";

pub fn file_name(exported_at: DateTime<Utc>) -> String {
    format!(
        "olauda-export-{}.zip",
        exported_at.format("%Y-%m-%d")
    )
}

/// Serializing and compressing are CPU-bound, so they run off the executor.
pub async fn build(export: DataExport) -> AppResult<Vec<u8>> {
    tokio::task::spawn_blocking(move || write_archive(&export))
        .await
        .map_err(|_| AppError::internal("Data export task failed"))?
        .map_err(AppError::from)
}

fn write_archive(export: &DataExport) -> anyhow::Result<Vec<u8>> {
    let account = &export.account.account;
    let locale = Locale::from_stored(account.preferences.get("language").and_then(Value::as_str));
    let (notice_name, notice) = notice_for(locale);
    let notice = notice
        .replace(
            "{exported_at}",
            &export.exported_at.format("%Y-%m-%d %H:%M").to_string(),
        )
        .replace("{email}", &account.email);
    let data = serde_json::to_vec_pretty(export).context("Failed to serialize data export")?;

    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .last_modified_time(zip_timestamp(export.exported_at)?);

    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    for (name, content) in [(notice_name, notice.as_bytes()), (DATA_FILE, &data)] {
        zip.start_file(name, options)?;
        zip.write_all(content)?;
    }

    Ok(zip.finish()?.into_inner())
}

fn notice_for(locale: Locale) -> (&'static str, &'static str) {
    match locale {
        Locale::De => ("LIESMICH.txt", NOTICE_DE),
        Locale::En => ("README.txt", NOTICE_EN),
    }
}

/// ZIP entries carry a local date without a zone; the notice says it is UTC.
fn zip_timestamp(at: DateTime<Utc>) -> anyhow::Result<zip::DateTime> {
    let year = u16::try_from(at.year()).context("Export year out of range")?;
    // Every other component is bounded by the calendar and fits a u8.
    zip::DateTime::from_date_and_time(
        year,
        at.month() as u8,
        at.day() as u8,
        at.hour() as u8,
        at.minute() as u8,
        at.second() as u8,
    )
    .context("Export time out of ZIP range")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_export::dto::*;
    use chrono::TimeZone;
    use std::io::Read;
    use zip::ZipArchive;

    #[test]
    fn file_names_carry_the_export_date() {
        let at = Utc.with_ymd_and_hms(2026, 10, 6, 23, 59, 0).unwrap();
        assert_eq!(file_name(at), "olauda-export-2026-10-06.zip");
    }

    #[test]
    fn both_notices_fill_every_placeholder() {
        for locale in [Locale::De, Locale::En] {
            let (_, notice) = notice_for(locale);
            assert!(notice.contains("{exported_at}") && notice.contains("{email}"));

            let filled = notice.replace("{exported_at}", "").replace("{email}", "");
            assert!(!filled.contains('{'), "unfilled placeholder in {locale:?}");
        }
    }

    fn export_in(language: &str) -> DataExport {
        let at = Utc.with_ymd_and_hms(2026, 10, 6, 12, 30, 0).unwrap();
        DataExport {
            format: FORMAT,
            version: FORMAT_VERSION,
            exported_at: at,
            account: AccountExport {
                account: Account {
                    id: uuid::Uuid::nil(),
                    email: "student@example.com".into(),
                    has_password: true,
                    mfa_enabled: false,
                    mfa_failed_attempts: 0,
                    mfa_locked_until: None,
                    password_failed_attempts: 0,
                    password_locked_until: None,
                    reauth_failed_attempts: 0,
                    reauth_locked_until: None,
                    personalized: true,
                    preferences: serde_json::json!({ "language": language }),
                    platform_role: None,
                    last_active_group_id: None,
                    last_login_at: None,
                    banned_at: None,
                    created_at: at,
                    updated_at: at,
                },
                display_name: "Quiet Otter".into(),
            },
            linked_accounts: vec![],
            groups: GroupsExport {
                memberships: vec![],
                courses: vec![],
                bans: vec![],
                mutes: vec![],
                invites: vec![],
            },
            content: ContentExport {
                tasks: vec![],
                files: vec![],
                announcements: vec![],
                system_announcements: vec![],
                private_todos: vec![],
            },
            interactions: InteractionsExport {
                task_states: vec![],
                read_announcements: vec![],
                read_system_announcements: vec![],
            },
            reports: ReportsExport {
                filed: vec![],
                about_your_content: vec![],
            },
            security: SecurityExport {
                passkeys: vec![],
                recovery_codes: vec![],
                sessions: vec![],
                events: vec![],
                password_resets: vec![],
                email_verifications: vec![],
            },
            activity_log: vec![],
        }
    }

    fn read_entry(archive: &mut ZipArchive<Cursor<Vec<u8>>>, name: &str) -> String {
        let mut content = String::new();
        archive
            .by_name(name)
            .unwrap()
            .read_to_string(&mut content)
            .unwrap();
        content
    }

    #[test]
    fn archives_hold_the_data_and_a_notice_in_the_users_language() {
        let bytes = write_archive(&export_in("de")).unwrap();
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();

        let notice = read_entry(&mut archive, "LIESMICH.txt");
        assert!(notice.contains("student@example.com"));
        assert!(notice.contains("2026-10-06 12:30"));

        let data: Value = serde_json::from_str(&read_entry(&mut archive, DATA_FILE)).unwrap();
        assert_eq!(data["format"], FORMAT);
        assert_eq!(data["account"]["displayName"], "Quiet Otter");
        assert_eq!(data["account"]["email"], "student@example.com");
    }

    #[test]
    fn english_speakers_get_an_english_notice() {
        let bytes = write_archive(&export_in("en")).unwrap();
        let archive = ZipArchive::new(Cursor::new(bytes)).unwrap();

        assert!(archive.file_names().any(|name| name == "README.txt"));
        assert!(!archive.file_names().any(|name| name == "LIESMICH.txt"));
    }
}
