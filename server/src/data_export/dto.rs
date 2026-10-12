//! The shape of `data.json`. Field names are part of the export format, so
//! renaming one is a breaking change for anyone importing the file.

use crate::common::cloudinary::ResourceType;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

pub const FORMAT: &str = "olauda/data-export";
pub const FORMAT_VERSION: u32 = 3;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataExport {
    pub format: &'static str,
    pub version: u32,
    pub exported_at: DateTime<Utc>,
    pub account: AccountExport,
    pub linked_accounts: Vec<LinkedAccount>,
    pub groups: GroupsExport,
    pub content: ContentExport,
    pub interactions: InteractionsExport,
    pub reports: ReportsExport,
    pub security: SecurityExport,
    pub activity_log: Vec<ActivityEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountExport {
    #[serde(flatten)]
    pub account: Account,
    /// The generated name other group members see instead of the email.
    pub display_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: Uuid,
    pub email: String,
    pub has_password: bool,
    pub mfa_enabled: bool,
    pub mfa_failed_attempts: i32,
    pub mfa_locked_until: Option<DateTime<Utc>>,
    pub password_failed_attempts: i32,
    pub password_locked_until: Option<DateTime<Utc>>,
    pub reauth_failed_attempts: i32,
    pub reauth_locked_until: Option<DateTime<Utc>>,
    pub personalized: bool,
    pub preferences: Value,
    pub platform_role: Option<String>,
    pub last_active_group_id: Option<Uuid>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub banned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedAccount {
    pub provider: String,
    pub provider_user_id: String,
    pub provider_email: String,
    pub linked_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupsExport {
    pub memberships: Vec<Membership>,
    pub courses: Vec<CourseChoice>,
    pub bans: Vec<GroupBan>,
    pub invites: Vec<GroupInvite>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Membership {
    pub group_id: Uuid,
    pub group_name: String,
    pub role: String,
    pub is_owner: bool,
    pub done_course_setup: bool,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseChoice {
    pub group_id: Uuid,
    pub subject: String,
    pub course: String,
    pub course_type: Option<String>,
    pub enrolled_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupBan {
    pub group_id: Uuid,
    pub group_name: String,
    pub banned_at: DateTime<Utc>,
}

/// Invites the user created, used or revoked. Who else used an invite is
/// another member's data and stays out; the token is a bearer credential.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupInvite {
    pub group_id: Uuid,
    pub group_name: String,
    pub created_by_you: bool,
    pub used_by_you: bool,
    pub revoked_by_you: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentExport {
    pub tasks: Vec<Task>,
    pub files: Vec<UploadedFile>,
    pub announcements: Vec<Announcement>,
    pub system_announcements: Vec<SystemAnnouncement>,
    pub private_todos: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: Uuid,
    pub group_id: Uuid,
    pub group_name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub subject: String,
    pub course: Option<String>,
    pub description: Option<String>,
    pub editor_note: Option<String>,
    pub due_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedFile {
    pub name: Option<String>,
    pub format: String,
    pub resource_type: ResourceType,
    pub purpose: String,
    pub task_id: Option<Uuid>,
    pub uploaded_at: DateTime<Utc>,
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    pub id: Uuid,
    pub group_id: Uuid,
    pub group_name: String,
    pub content: String,
    pub important: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// An announcement to every user, posted as a superadmin.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemAnnouncement {
    pub id: Uuid,
    pub content: String,
    pub important: bool,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractionsExport {
    pub task_states: Vec<TaskState>,
    pub read_announcements: Vec<AnnouncementRead>,
    pub read_system_announcements: Vec<AnnouncementRead>,
}

/// A task the user checked off, pinned, archived or kept.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskState {
    pub task_id: Uuid,
    pub state: String,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnouncementRead {
    pub announcement_id: Uuid,
    pub read_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportsExport {
    pub filed: Vec<FiledReport>,
    pub about_your_content: Vec<ReportAboutYou>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FiledReport {
    #[serde(rename = "type")]
    pub kind: String,
    pub reason: Option<String>,
    pub reporter_email: Option<String>,
    pub reported_at: DateTime<Utc>,
    pub reported_content: Value,
}

/// Who reported the content and why stays out: it would expose the reporter
/// (Art. 15(4) GDPR, § 29(1) BDSG).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportAboutYou {
    #[serde(rename = "type")]
    pub kind: String,
    pub reported_at: DateTime<Utc>,
    pub reported_content: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityExport {
    pub passkeys: Vec<PasskeyRecord>,
    pub recovery_codes: Vec<RecoveryCodeRecord>,
    pub sessions: Vec<Session>,
    pub events: Vec<SecurityEventEntry>,
    pub password_resets: Vec<PasswordReset>,
    pub email_verifications: Vec<EmailVerification>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRecord {
    pub name: String,
    /// Hex-encoded, the same identifier the authenticator holds.
    pub credential_id: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Only when a code was created and used: the codes themselves are stored as
/// keyed hashes that identify nothing on their own.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCodeRecord {
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

/// One sign-in, summarised over all of its rotated refresh tokens.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: Uuid,
    pub started_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<String>,
    pub ip_addresses: Vec<String>,
    pub user_agents: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityEventEntry {
    pub event_type: String,
    pub outcome: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub group_id: Option<Uuid>,
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordReset {
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub used: bool,
    pub attempts: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailVerification {
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    #[serde(rename = "type")]
    pub kind: String,
    pub meta: Option<Value>,
    pub created_at: DateTime<Utc>,
}
