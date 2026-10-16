use super::dto::*;
use crate::{
    common::{
        client::ClientInfo,
        cloudinary::{Cloudinary, ResourceType},
        name_generator::generate_user_name,
    },
    error::{AppError, AppResult},
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
    todos::service::TodoService,
};
use chrono::Utc;
use serde_json::{Map, Value};
use sqlx::PgPool;
use uuid::Uuid;

/// What a report snapshot may reveal. The snapshot also names the content's
/// author and other members' uploads, which belong to someone else.
const REPORTED_TASK_FIELDS: &[&str] = &[
    "itemId",
    "itemType",
    "itemTitle",
    "itemSubject",
    "itemCourse",
    "itemDescription",
    "itemDueDate",
    "itemTenantId",
];

pub struct DataExportService {
    db: PgPool,
    cloudinary: Cloudinary,
    todos: TodoService,
}

impl DataExportService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            cloudinary: state.cloudinary.clone(),
            todos: TodoService::from_state(state),
        }
    }

    /// Everything stored about `user_id`, read from one snapshot so the parts
    /// agree with each other.
    pub async fn collect(&self, user_id: Uuid) -> AppResult<DataExport> {
        let mut tx = self.db.begin().await?;

        sqlx::query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            .execute(&mut *tx)
            .await?;

        let account = sqlx::query_as!(
            Account,
            r#"SELECT u.id, u.email,
                      u.password_hash IS NOT NULL AS "has_password!",
                      u.mfa_enabled, u.mfa_failed_attempts, u.mfa_locked_until,
                      u.password_failed_attempts, u.password_locked_until,
                      u.reauth_failed_attempts, u.reauth_locked_until,
                      u.personalized, u.preferences,
                      (SELECT r.name FROM user_roles ur
                       JOIN roles r ON r.id = ur.role_id
                       WHERE ur.user_id = u.id AND ur.tenant_id IS NULL
                       ORDER BY r.id LIMIT 1) AS "platform_role?",
                      u.last_active_group_id, u.last_login_at,
                      (SELECT b.banned_at FROM banned_users b WHERE b.user_id = u.id) AS "banned_at?",
                      u.created_at, u.updated_at
               FROM users u
               WHERE u.id = $1"#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("User not found"))?;

        let linked_accounts = sqlx::query_as!(
            LinkedAccount,
            r#"SELECT provider, provider_user_id, provider_email, linked_at
               FROM oauth_accounts
               WHERE user_id = $1
               ORDER BY linked_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let memberships = sqlx::query_as!(
            Membership,
            r#"SELECT g.id AS group_id, g.name AS group_name, r.name AS role,
                      g.owner_id = ur.user_id AS "is_owner!",
                      ur.done_course_setup, ur.assigned_at AS joined_at
               FROM user_roles ur
               JOIN groups g ON g.id = ur.tenant_id
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = $1
               ORDER BY ur.assigned_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let courses = sqlx::query_as!(
            CourseChoice,
            r#"SELECT s.tenant_id AS group_id, s.name AS subject, c.name AS course,
                      c.course_type, uc.enrolled_at
               FROM user_courses uc
               JOIN subjects s ON s.id = uc.subject_id
               JOIN courses c ON c.id = uc.course_id
               WHERE uc.user_id = $1
               ORDER BY s.tenant_id, s.name"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let bans = sqlx::query_as!(
            GroupBan,
            r#"SELECT b.tenant_id AS group_id, g.name AS group_name, b.banned_at
               FROM group_bans b
               JOIN groups g ON g.id = b.tenant_id
               WHERE b.user_id = $1
               ORDER BY b.banned_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let mutes = sqlx::query_as!(
            GroupMute,
            r#"SELECT m.tenant_id AS group_id, g.name AS group_name, m.muted_at
               FROM group_mutes m
               JOIN groups g ON g.id = m.tenant_id
               WHERE m.user_id = $1
               ORDER BY m.muted_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let invites = sqlx::query_as!(
            GroupInvite,
            r#"SELECT i.tenant_id AS group_id, g.name AS group_name,
                      i.created_by IS NOT DISTINCT FROM $1 AS "created_by_you!",
                      i.used_by IS NOT DISTINCT FROM $1 AS "used_by_you!",
                      i.revoked_by IS NOT DISTINCT FROM $1 AS "revoked_by_you!",
                      i.created_at, i.expires_at, i.used_at, i.revoked_at
               FROM group_invites i
               JOIN groups g ON g.id = i.tenant_id
               WHERE $1 IN (i.created_by, i.used_by, i.revoked_by)
               ORDER BY i.created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let tasks = sqlx::query_as!(
            Task,
            r#"SELECT i.id, i.tenant_id AS group_id, g.name AS group_name, i.type AS kind,
                      i.title, COALESCE(s.name, i.custom_subject) AS "subject!",
                      c.name AS "course?", i.description, i.editor_note,
                      i.due_date, i.created_at, i.updated_at
               FROM items i
               JOIN groups g ON g.id = i.tenant_id
               LEFT JOIN subjects s ON s.id = i.subject_id
               LEFT JOIN courses c ON c.id = i.course_id
               WHERE i.created_by = $1
               ORDER BY i.created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        // Thumbnails are derived from the user's documents, not uploaded by them.
        let files = sqlx::query!(
            r#"SELECT a.public_id, a.resource_type AS "resource_type: ResourceType",
                      a.format, a.purpose, a.original_name, a.uploaded_at,
                      at.item_id AS "item_id?"
               FROM assets a
               LEFT JOIN item_attachments at ON at.asset_id = a.id
               WHERE a.uploaded_by = $1 AND a.purpose <> 'thumbnail'
               ORDER BY a.uploaded_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|f| UploadedFile {
            url: self
                .cloudinary
                .original_url(&f.public_id, f.resource_type, &f.format),
            name: f.original_name,
            format: f.format,
            resource_type: f.resource_type,
            purpose: f.purpose,
            task_id: f.item_id,
            uploaded_at: f.uploaded_at,
        })
        .collect();

        let announcements = sqlx::query_as!(
            Announcement,
            r#"SELECT a.id, a.tenant_id AS group_id, g.name AS group_name,
                      a.content, a.important, a.created_at, a.updated_at
               FROM announcements a
               JOIN groups g ON g.id = a.tenant_id
               WHERE a.created_by = $1
               ORDER BY a.created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let system_announcements = sqlx::query_as!(
            SystemAnnouncement,
            r#"SELECT id, content, important, starts_at, ends_at, created_at
               FROM system_announcements
               WHERE created_by = $1
               ORDER BY created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let task_states = sqlx::query_as!(
            TaskState,
            r#"SELECT x.task_id AS "task_id!", x.state AS "state!", x.at AS "at!"
               FROM (
                   SELECT item_id AS task_id, 'checked' AS state, checked_at AS at
                   FROM keep_checked WHERE user_id = $1
                   UNION ALL
                   SELECT item_id, 'pinned', pinned_at
                   FROM pinned_items WHERE user_id = $1
                   UNION ALL
                   SELECT item_id, status, archived_at
                   FROM user_item_visibility WHERE user_id = $1 AND status IS NOT NULL
               ) x
               ORDER BY x.at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let read_announcements = sqlx::query_as!(
            AnnouncementRead,
            r#"SELECT announcement_id, read_at
               FROM user_announcement_read_status
               WHERE user_id = $1
               ORDER BY read_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let read_system_announcements = sqlx::query_as!(
            AnnouncementRead,
            r#"SELECT announcement_id, read_at
               FROM system_announcement_reads
               WHERE user_id = $1
               ORDER BY read_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let filed_reports = sqlx::query!(
            r#"SELECT report_type, reason, reporter_email, reported_at, details
               FROM reports
               WHERE reporter_id = $1
               ORDER BY reported_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|r| FiledReport {
            reported_content: reported_content(&r.report_type, r.details),
            kind: r.report_type,
            reason: r.reason,
            reporter_email: r.reporter_email,
            reported_at: r.reported_at,
        })
        .collect();

        // Task snapshots name their author by email only.
        let reports_about_you = sqlx::query!(
            r#"SELECT report_type, reported_at, details
               FROM reports
               WHERE details->>'creatorEmail' = $1
               ORDER BY reported_at"#,
            account.email
        )
        .fetch_all(&mut *tx)
        .await?
        .into_iter()
        .map(|r| ReportAboutYou {
            reported_content: reported_content(&r.report_type, r.details),
            kind: r.report_type,
            reported_at: r.reported_at,
        })
        .collect();

        let sessions = sqlx::query_as!(
            Session,
            r#"SELECT family_id AS id,
                      min(issued_at) AS "started_at!",
                      max(last_used_at) AS "last_used_at!",
                      max(expires_at) AS "expires_at!",
                      max(revoked_at) AS "revoked_at?",
                      (array_agg(revoked_reason ORDER BY issued_at DESC))[1] AS "revoked_reason?",
                      COALESCE(array_agg(DISTINCT host(ip_address))
                               FILTER (WHERE ip_address IS NOT NULL), '{}') AS "ip_addresses!",
                      COALESCE(array_agg(DISTINCT user_agent)
                               FILTER (WHERE user_agent IS NOT NULL), '{}') AS "user_agents!"
               FROM refresh_tokens
               WHERE user_id = $1
               GROUP BY family_id
               ORDER BY min(issued_at)"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let passkeys = sqlx::query_as!(
            PasskeyRecord,
            r#"SELECT name, encode(credential_id, 'hex') AS "credential_id!", created_at, last_used_at
               FROM passkeys
               WHERE user_id = $1
               ORDER BY created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let recovery_codes = sqlx::query_as!(
            RecoveryCodeRecord,
            r#"SELECT created_at, used_at
               FROM mfa_recovery_codes
               WHERE user_id = $1
               ORDER BY created_at, used_at NULLS LAST"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        // Where someone else acted on the account, such as an admin, the
        // address and browser are theirs and stay out.
        let security_events = sqlx::query_as!(
            SecurityEventEntry,
            r#"SELECT event_type, outcome,
                      CASE WHEN actor_id IS NULL OR actor_id = $1
                           THEN host(ip_address) END AS "ip_address?",
                      CASE WHEN actor_id IS NULL OR actor_id = $1
                           THEN user_agent END AS "user_agent?",
                      tenant_id AS group_id, metadata, created_at
               FROM security_events
               WHERE user_id = $1 OR actor_id = $1
               ORDER BY created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        let password_resets = sqlx::query_as!(
            PasswordReset,
            r#"SELECT created_at, expires_at, used, attempts
               FROM password_resets
               WHERE email = $1
               ORDER BY created_at"#,
            account.email
        )
        .fetch_all(&mut *tx)
        .await?;

        let email_verifications = sqlx::query_as!(
            EmailVerification,
            r#"SELECT created_at, expires_at
               FROM verifications
               WHERE email = $1
               ORDER BY created_at"#,
            account.email
        )
        .fetch_all(&mut *tx)
        .await?;

        let activity_log = sqlx::query_as!(
            ActivityEntry,
            r#"SELECT type AS kind, meta, created_at
               FROM user_activity
               WHERE user_id = $1
               ORDER BY created_at"#,
            user_id
        )
        .fetch_all(&mut *tx)
        .await?;

        tx.commit().await?;

        // Decrypting needs the user's derived key, which the service caches.
        let private_todos = self.todos.get_todos(user_id).await?;

        Ok(DataExport {
            format: FORMAT,
            version: FORMAT_VERSION,
            exported_at: Utc::now(),
            account: AccountExport {
                display_name: generate_user_name(&user_id.to_string()),
                account,
            },
            linked_accounts,
            groups: GroupsExport {
                memberships,
                courses,
                bans,
                mutes,
                invites,
            },
            content: ContentExport {
                tasks,
                files,
                announcements,
                system_announcements,
                private_todos,
            },
            interactions: InteractionsExport {
                task_states,
                read_announcements,
                read_system_announcements,
            },
            reports: ReportsExport {
                filed: filed_reports,
                about_your_content: reports_about_you,
            },
            security: SecurityExport {
                passkeys,
                recovery_codes,
                sessions,
                events: security_events,
                password_resets,
                email_verifications,
            },
            activity_log,
        })
    }

    /// Recorded so the operator can show when access was granted (Art. 5(2)
    /// GDPR), and because a copy of everything is what a stolen account is
    /// most worth.
    pub async fn log_export(&self, user_id: Uuid, client: &ClientInfo) -> AppResult<()> {
        SecurityEvent::new(SecurityEventKind::DataExported)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&self.db)
            .await?;

        Ok(())
    }
}

fn reported_content(report_type: &str, details: Value) -> Value {
    let allowed = match report_type {
        "task" => REPORTED_TASK_FIELDS,
        _ => &[],
    };

    let Value::Object(mut snapshot) = details else {
        return Value::Object(Map::new());
    };

    snapshot.retain(|key, _| allowed.contains(&key.as_str()));
    Value::Object(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn task_snapshots_drop_the_author_and_attachments() {
        let details = json!({
            "itemId": "i",
            "itemTitle": "Mathe",
            "itemEditorNote": "note by a moderator",
            "itemAttachments": [{ "createdBy": "someone" }],
            "creatorEmail": "author@example.com",
        });

        assert_eq!(
            reported_content("task", details),
            json!({ "itemId": "i", "itemTitle": "Mathe" })
        );
    }

    #[test]
    fn unknown_report_types_reveal_nothing() {
        assert_eq!(
            reported_content("other", json!({ "itemId": "i" })),
            json!({})
        );
        assert_eq!(reported_content("task", json!("legacy")), json!({}));
    }
}
