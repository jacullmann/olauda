use super::dto::*;
use crate::{
    auth::{
        security_notice,
        session_context::is_superadmin,
        token::{ADMIN_REVOKE, TokenService},
    },
    common::{
        client::ClientInfo,
        cloudinary::Cloudinary,
        email::{EmailService, EmailStatsError, SecurityNotice},
        hetzner::{HetznerCloud, HetznerError},
        pagination::{Window, search_params},
        role::{MemberRole, Role},
    },
    error::{AppError, AppResult},
    group::{
        member_policy::{self, Caller, Target},
        service::role_from_db,
    },
    mfa::service::disable_mfa,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use chrono::Utc;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const STATS_WINDOW_DAYS: i32 = 7;
const DAILY_ACTIVITY_DAYS: i32 = 30;
/// The longest whole number of weeks inside the 30 days of activity that are kept.
const WEEKLY_RHYTHM_WEEKS: i32 = 4;

/// The server's load as Hetzner measures it, read live on every request: the
/// overview is opened rarely enough to stay far below the API's rate limit.
pub async fn read_server_metrics(
    hetzner: &HetznerCloud,
    range: MetricsRange,
) -> AppResult<ServerMetricsDto> {
    let end = Utc::now();
    let start = end - range.span();

    let (cpu_cores, metrics) = tokio::try_join!(
        hetzner.server_cores(),
        hetzner.server_metrics(start, end, range.step()),
    )
    .map_err(hetzner_failure)?;

    Ok(ServerMetricsDto {
        start: start.timestamp(),
        end: end.timestamp(),
        cpu_cores,
        cpu: metrics.cpu,
        network_in: metrics.network_in,
        network_out: metrics.network_out,
    })
}

/// Resend's numbers, read live like the server metrics: the overview is
/// opened far too rarely to need a cache.
pub async fn read_email_activity(email: &EmailService) -> AppResult<EmailActivityDto> {
    let days = DAILY_ACTIVITY_DAYS.unsigned_abs();
    Ok(email.activity(days).await.map_err(resend_failure)?.into())
}

pub async fn read_email_quota(email: &EmailService) -> AppResult<EmailQuotaDto> {
    Ok(email.monthly_quota().await.map_err(resend_failure)?.into())
}

fn resend_failure(error: EmailStatsError) -> AppError {
    let (code, message) = match error {
        EmailStatsError::NotConfigured => ("RESEND_NOT_CONFIGURED", "RESEND_API_KEY is not set."),
        EmailStatsError::KeyRejected => (
            "RESEND_KEY_REJECTED",
            "Resend refused RESEND_API_KEY; reading metrics needs a full access key.",
        ),
        EmailStatsError::Resend(e) => {
            tracing::error!("Resend API request failed: {e}");
            ("RESEND_UNREACHABLE", "The Resend API could not be reached.")
        }
    };
    AppError::Upstream { code, message }
}

fn hetzner_failure(error: HetznerError) -> AppError {
    let (code, message) = match error {
        HetznerError::TokenRejected => (
            "HETZNER_TOKEN_REJECTED",
            "Hetzner rejected HETZNER_API_TOKEN.",
        ),
        HetznerError::ServerNotFound => (
            "HETZNER_SERVER_NOT_FOUND",
            "Hetzner knows no server with HETZNER_SERVER_ID.",
        ),
        HetznerError::Http(e) => {
            tracing::error!("Hetzner API request failed: {e}");
            (
                "HETZNER_UNREACHABLE",
                "The Hetzner API could not be reached.",
            )
        }
    };
    AppError::Upstream { code, message }
}

pub struct SuperAdminService {
    db: PgPool,
    tokens: TokenService,
    cloudinary: Cloudinary,
    email: EmailService,
}

impl SuperAdminService {
    pub fn from_state(s: &AppState) -> Self {
        Self {
            db: s.db.clone(),
            tokens: TokenService::from_state(s),
            cloudinary: s.cloudinary.clone(),
            email: s.email.clone(),
        }
    }

    /// One round trip that scans each large table once.
    pub async fn get_stats(&self) -> AppResult<StatsDto> {
        let row = sqlx::query!(
            r#"SELECT u.total AS "user_count!",
                      u.new_recently AS "new_users!", u.active_recently AS "active_users!",
                      i.total AS "item_count!", i.new_recently AS "new_items!",
                      (SELECT COUNT(*) FROM user_roles
                       WHERE tenant_id IS NULL AND role_id = $1) AS "admin_count!",
                      (SELECT COUNT(*) FROM banned_users) AS "banned_count!",
                      (SELECT COUNT(*) FROM reports) AS "report_count!",
                      (SELECT COUNT(DISTINCT email) FROM verifications
                       WHERE expires_at > now()) AS "pending_sign_ups!"
               FROM (SELECT COUNT(*) AS total,
                            COUNT(*) FILTER (WHERE created_at >= now() - make_interval(days => $2)) AS new_recently,
                            COUNT(*) FILTER (WHERE last_login_at >= now() - make_interval(days => $2)) AS active_recently
                     FROM users) u,
                    (SELECT COUNT(*) AS total,
                            COUNT(*) FILTER (WHERE created_at >= now() - make_interval(days => $2)) AS new_recently
                     FROM items) i"#,
            Role::Superadmin.db_id_i32(),
            STATS_WINDOW_DAYS,
        )
        .fetch_one(&self.db)
        .await?;

        Ok(StatsDto {
            user_count: row.user_count,
            pending_sign_ups: row.pending_sign_ups,
            admin_count: row.admin_count,
            banned_count: row.banned_count,
            new_users_this_week: row.new_users,
            active_users_this_week: row.active_users,
            item_count: row.item_count,
            new_items_this_week: row.new_items,
            report_count: row.report_count,
        })
    }

    /// One scan of the accounts, with the passkey and Google lookups served by
    /// the indexes on `user_id`.
    pub async fn get_account_security(&self) -> AppResult<AccountSecurityDto> {
        let row = sqlx::query!(
            r#"SELECT COUNT(*) FILTER (WHERE NOT mfa AND NOT passkey) AS "neither!",
                      COUNT(*) FILTER (WHERE mfa AND NOT passkey) AS "mfa_only!",
                      COUNT(*) FILTER (WHERE passkey AND NOT mfa) AS "passkey_only!",
                      COUNT(*) FILTER (WHERE mfa AND passkey) AS "both!",
                      COUNT(*) FILTER (WHERE NOT google) AS "not_linked!",
                      COUNT(*) FILTER (WHERE google AND password) AS "linked!",
                      COUNT(*) FILTER (WHERE google AND NOT password) AS "google_only!"
               FROM (SELECT u.mfa_enabled AND u.mfa_secret IS NOT NULL AS mfa,
                            u.password_hash IS NOT NULL AS password,
                            EXISTS (SELECT 1 FROM passkeys p WHERE p.user_id = u.id) AS passkey,
                            EXISTS (SELECT 1 FROM oauth_accounts o
                                    WHERE o.user_id = u.id AND o.provider = 'google') AS google
                     FROM users u) accounts"#
        )
        .fetch_one(&self.db)
        .await?;

        Ok(AccountSecurityDto {
            second_factor: SecondFactorBreakdown {
                neither: row.neither,
                mfa_only: row.mfa_only,
                passkey_only: row.passkey_only,
                both: row.both,
            },
            google: GoogleBreakdown {
                not_linked: row.not_linked,
                linked: row.linked,
                google_only: row.google_only,
            },
        })
    }

    /// Growth, usage and failed sign-ins per day, oldest first, with empty days included.
    pub async fn get_daily_activity(&self) -> AppResult<Vec<DailyActivityDto>> {
        let rows = sqlx::query!(
            r#"SELECT d.day AS "day!",
                      COALESCE(u.n, 0) AS "new_users!",
                      COALESCE(g.n, 0) AS "new_groups!",
                      COALESCE(i.n, 0) AS "new_items!",
                      COALESCE(a.app_opens, 0) AS "app_opens!",
                      COALESCE(a.active_users, 0) AS "active_users!",
                      COALESCE(f.n, 0) AS "failed_logins!"
               FROM (SELECT current_date - offset_days AS day
                     FROM generate_series($1 - 1, 0, -1) AS offset_days) d
               LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM users
                          WHERE created_at >= current_date - ($1 - 1)
                          GROUP BY 1) u USING (day)
               LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM groups
                          WHERE created_at >= current_date - ($1 - 1)
                          GROUP BY 1) g USING (day)
               LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM items
                          WHERE created_at >= current_date - ($1 - 1)
                          GROUP BY 1) i USING (day)
               LEFT JOIN (SELECT created_at::date AS day,
                                 COUNT(*) FILTER (WHERE type = 'page:load') AS app_opens,
                                 COUNT(DISTINCT user_id) AS active_users
                          FROM user_activity
                          WHERE created_at >= current_date - ($1 - 1)
                          GROUP BY 1) a USING (day)
               LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS n FROM security_events
                          WHERE event_type = $2 AND outcome = $3
                            AND created_at >= current_date - ($1 - 1)
                          GROUP BY 1) f USING (day)
               ORDER BY d.day"#,
            DAILY_ACTIVITY_DAYS,
            SecurityEventKind::SignInFailed.event_type(),
            SecurityEventKind::SignInFailed.outcome().as_str(),
        )
        .fetch_all(&self.db)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| DailyActivityDto {
                day: r.day,
                new_users: r.new_users,
                new_groups: r.new_groups,
                new_items: r.new_items,
                app_opens: r.app_opens,
                active_users: r.active_users,
                failed_logins: r.failed_logins,
            })
            .collect())
    }

    pub async fn get_weekly_rhythm(&self) -> AppResult<WeeklyRhythmDto> {
        let rows = sqlx::query!(
            r#"SELECT EXTRACT(ISODOW FROM local_time)::int AS "weekday!",
                      EXTRACT(HOUR FROM local_time)::int AS "hour!",
                      COUNT(DISTINCT (user_id, local_time::date)) AS "active_users!"
               FROM (SELECT user_id, created_at AT TIME ZONE 'Europe/Berlin' AS local_time
                     FROM user_activity
                     WHERE type = 'page:load'
                       AND created_at >= now() - make_interval(weeks => $1)) opens
               GROUP BY 1, 2"#,
            WEEKLY_RHYTHM_WEEKS,
        )
        .fetch_all(&self.db)
        .await?;

        let mut active_users = [[0; HOURS_PER_DAY]; DAYS_PER_WEEK];
        for row in rows {
            let cell = usize::try_from(row.weekday - 1)
                .ok()
                .zip(usize::try_from(row.hour).ok())
                .and_then(|(day, hour)| active_users.get_mut(day)?.get_mut(hour));
            if let Some(cell) = cell {
                *cell = row.active_users;
            }
        }

        Ok(WeeklyRhythmDto {
            weeks: WEEKLY_RHYTHM_WEEKS,
            active_users,
        })
    }

    /// Whether each scheduled cleanup keeps up, judged by the rows it should
    /// already have removed. That is what the retention promised in the privacy
    /// policy depends on, and unlike pg_cron's run history (the `cron` schema)
    /// it exists in every environment, including ones without pg_cron.
    pub async fn get_cleanup_jobs(&self) -> AppResult<Vec<CleanupJobDto>> {
        let jobs = sqlx::query_as!(
            CleanupJobDto,
            r#"SELECT job AS "job!", overdue AS "overdue_count!" FROM cleanup_job_backlog()"#
        )
        .fetch_all(&self.db)
        .await?;

        Ok(jobs)
    }

    pub async fn list_groups(&self, query: &GroupsQuery) -> AppResult<Window<AdminGroupDto>> {
        let (pattern, search_id) = search_params(query.search.as_deref());
        let group_type = match query.r#type {
            GroupTypeFilter::All => None,
            filter => Some(filter.as_str()),
        };

        let rows_query = sqlx::query_as!(
            AdminGroupRow,
            r#"SELECT g.id, g.name, avatar.public_id AS "avatar_public_id?", g.group_type,
                      g.owner_id, g.created_at, g.banned_at, u.email AS owner_email,
                      members.n AS "member_count!", items.n AS "item_count!"
               FROM groups g
               JOIN users u ON u.id = g.owner_id
               LEFT JOIN assets avatar ON avatar.id = g.avatar_id
               CROSS JOIN LATERAL (SELECT COUNT(*) AS n FROM user_roles WHERE tenant_id = g.id) members
               CROSS JOIN LATERAL (SELECT COUNT(*) AS n FROM items WHERE tenant_id = g.id) items
               WHERE ($1::text IS NULL OR g.name ILIKE $1 OR u.email ILIKE $1 OR g.id = $2)
                 AND ($3::text IS NULL OR g.group_type = $3)
               ORDER BY
                 CASE WHEN $4 = 'name' AND $5 = 'asc' THEN g.name END ASC,
                 CASE WHEN $4 = 'name' AND $5 = 'desc' THEN g.name END DESC,
                 CASE WHEN $4 = 'memberCount' AND $5 = 'asc' THEN members.n END ASC,
                 CASE WHEN $4 = 'memberCount' AND $5 = 'desc' THEN members.n END DESC,
                 CASE WHEN $4 = 'itemCount' AND $5 = 'asc' THEN items.n END ASC,
                 CASE WHEN $4 = 'itemCount' AND $5 = 'desc' THEN items.n END DESC,
                 CASE WHEN $5 = 'asc' THEN g.created_at END ASC,
                 g.created_at DESC,
                 g.id
               LIMIT $6 OFFSET $7"#,
            pattern.as_deref(),
            search_id,
            group_type,
            query.sort.as_str(),
            query.order.as_str(),
            query.limit.get(),
            query.offset.get(),
        )
        .fetch_all(&self.db);

        let count_query = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!"
               FROM groups g
               JOIN users u ON u.id = g.owner_id
               WHERE ($1::text IS NULL OR g.name ILIKE $1 OR u.email ILIKE $1 OR g.id = $2)
                 AND ($3::text IS NULL OR g.group_type = $3)"#,
            pattern.as_deref(),
            search_id,
            group_type,
        )
        .fetch_one(&self.db);

        let (rows, total) = tokio::try_join!(rows_query, count_query)?;

        let groups = rows
            .into_iter()
            .map(|row| AdminGroupDto::from_row(row, &self.cloudinary))
            .collect();

        Ok(Window {
            items: groups,
            total,
        })
    }

    pub async fn get_group(&self, group_id: Uuid) -> AppResult<AdminGroupDto> {
        let row = sqlx::query_as!(
            AdminGroupRow,
            r#"SELECT g.id, g.name, avatar.public_id AS "avatar_public_id?", g.group_type,
                      g.owner_id, g.created_at, g.banned_at, u.email AS owner_email,
                      (SELECT COUNT(*) FROM user_roles WHERE tenant_id = g.id) AS "member_count!",
                      (SELECT COUNT(*) FROM items WHERE tenant_id = g.id) AS "item_count!"
               FROM groups g
               JOIN users u ON u.id = g.owner_id
               LEFT JOIN assets avatar ON avatar.id = g.avatar_id
               WHERE g.id = $1"#,
            group_id,
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(group_not_found)?;

        Ok(AdminGroupDto::from_row(row, &self.cloudinary))
    }

    /// Members keep their memberships and content; the tenant check turns
    /// every request to the group away until the ban is lifted.
    pub async fn ban_group(
        &self,
        group_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        // Banning twice keeps the original date.
        let group = sqlx::query!(
            r#"UPDATE groups SET banned_at = COALESCE(banned_at, now())
               WHERE id = $1
               RETURNING name, banned_at AS "banned_at!""#,
            group_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(group_not_found)?;

        SecurityEvent::new(SecurityEventKind::AdminGroupBanned)
            .actor(admin_id)
            .tenant(group_id)
            .client(client)
            .metadata(json!({ "groupName": group.name }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "bannedAt": group.banned_at }))
    }

    pub async fn unban_group(
        &self,
        group_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        let name = sqlx::query_scalar!(
            r#"UPDATE groups SET banned_at = NULL WHERE id = $1 RETURNING name"#,
            group_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(group_not_found)?;

        SecurityEvent::new(SecurityEventKind::AdminGroupUnbanned)
            .actor(admin_id)
            .tenant(group_id)
            .client(client)
            .metadata(json!({ "groupName": name }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "bannedAt": null }))
    }

    pub async fn delete_group(
        &self,
        group_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        // Everything in the group cascades with it; the asset sweep deletes
        // the files its items and avatar leave behind.
        let name = sqlx::query_scalar!(
            r#"DELETE FROM groups WHERE id = $1 RETURNING name"#,
            group_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(group_not_found)?;

        SecurityEvent::new(SecurityEventKind::AdminGroupDeleted)
            .actor(admin_id)
            .tenant(group_id)
            .client(client)
            .metadata(json!({ "groupName": name }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "deletedGroupId": group_id }))
    }

    pub async fn list_users(&self, query: &UsersQuery) -> AppResult<Window<AdminUserDto>> {
        let (pattern, search_id) = search_params(query.search.as_deref());
        let superadmin_role = Role::Superadmin.db_id_i32();

        let rows_query = sqlx::query_as!(
            AdminUserRow,
            r#"SELECT u.id, u.email, u.created_at, u.last_login_at,
                      u.mfa_enabled AND u.mfa_secret IS NOT NULL AS "mfa_enabled!",
                      EXISTS (SELECT 1 FROM user_roles ur
                              WHERE ur.user_id = u.id AND ur.tenant_id IS NULL
                                AND ur.role_id = $4) AS "is_superadmin!",
                      EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id) AS "is_banned!"
               FROM users u
               WHERE ($1::text IS NULL OR u.email ILIKE $1 OR u.id = $2)
                 AND CASE $3
                       WHEN 'active' THEN NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id)
                       WHEN 'banned' THEN EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id)
                       WHEN 'superadmin' THEN EXISTS (SELECT 1 FROM user_roles ur
                                                      WHERE ur.user_id = u.id AND ur.tenant_id IS NULL
                                                        AND ur.role_id = $4)
                       ELSE true
                     END
               ORDER BY
                 CASE WHEN $5 = 'email' AND $6 = 'asc' THEN u.email END ASC,
                 CASE WHEN $5 = 'email' AND $6 = 'desc' THEN u.email END DESC,
                 CASE WHEN $5 = 'lastLoginAt' AND $6 = 'asc' THEN u.last_login_at END ASC NULLS FIRST,
                 CASE WHEN $5 = 'lastLoginAt' AND $6 = 'desc' THEN u.last_login_at END DESC NULLS LAST,
                 CASE WHEN $6 = 'asc' THEN u.created_at END ASC,
                 u.created_at DESC,
                 u.id
               LIMIT $7 OFFSET $8"#,
            pattern.as_deref(),
            search_id,
            query.status.as_str(),
            superadmin_role,
            query.sort.as_str(),
            query.order.as_str(),
            query.limit.get(),
            query.offset.get(),
        )
        .fetch_all(&self.db);

        let count_query = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "count!"
               FROM users u
               WHERE ($1::text IS NULL OR u.email ILIKE $1 OR u.id = $2)
                 AND CASE $3
                       WHEN 'active' THEN NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id)
                       WHEN 'banned' THEN EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id)
                       WHEN 'superadmin' THEN EXISTS (SELECT 1 FROM user_roles ur
                                                      WHERE ur.user_id = u.id AND ur.tenant_id IS NULL
                                                        AND ur.role_id = $4)
                       ELSE true
                     END"#,
            pattern.as_deref(),
            search_id,
            query.status.as_str(),
            superadmin_role,
        )
        .fetch_one(&self.db);

        let (rows, total) = tokio::try_join!(rows_query, count_query)?;

        let users = rows.into_iter().map(AdminUserDto::from).collect();

        Ok(Window {
            items: users,
            total,
        })
    }

    pub async fn get_user(&self, user_id: Uuid) -> AppResult<AdminUserDto> {
        let row = sqlx::query_as!(
            AdminUserRow,
            r#"SELECT u.id, u.email, u.created_at, u.last_login_at,
                      u.mfa_enabled AND u.mfa_secret IS NOT NULL AS "mfa_enabled!",
                      EXISTS (SELECT 1 FROM user_roles ur
                              WHERE ur.user_id = u.id AND ur.tenant_id IS NULL
                                AND ur.role_id = $2) AS "is_superadmin!",
                      EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id) AS "is_banned!"
               FROM users u
               WHERE u.id = $1"#,
            user_id,
            Role::Superadmin.db_id_i32(),
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        Ok(row.into())
    }

    /// The roles offered per group come from the same policy the group admin
    /// UI uses, evaluated with the owner rights every superadmin holds.
    pub async fn get_user_memberships(
        &self,
        user_id: Uuid,
        admin_id: Uuid,
    ) -> AppResult<Vec<UserMembershipDto>> {
        let rows = sqlx::query!(
            r#"SELECT g.id, g.name, g.owner_id, ur.role_id, ur.assigned_at,
                      m.user_id IS NOT NULL AS "muted!"
               FROM user_roles ur
               JOIN groups g ON g.id = ur.tenant_id
               LEFT JOIN group_mutes m ON m.tenant_id = ur.tenant_id AND m.user_id = ur.user_id
               WHERE ur.user_id = $1
               ORDER BY g.name, g.id"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let caller = superadmin_caller(admin_id);

        rows.into_iter()
            .map(|r| {
                let target = Target {
                    user_id,
                    role: MemberRole::resolve(role_from_db(r.role_id)?, r.owner_id == user_id),
                };
                Ok(UserMembershipDto {
                    group_id: r.id,
                    group_name: r.name,
                    role: target.role,
                    joined_at: r.assigned_at,
                    muted: r.muted,
                    assignable_roles: member_policy::assignable_roles(
                        caller.resolve(r.owner_id, None),
                        target,
                    ),
                })
            })
            .collect()
    }

    pub async fn ban_user(
        &self,
        target_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        if is_superadmin(&self.db, target_id).await? {
            return Err(AppError::bad_request("Admins cannot be banned."));
        }

        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"INSERT INTO banned_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING"#,
            target_id
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::AdminUserBanned)
            .user(target_id)
            .actor(admin_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        self.tokens
            .revoke_all_for_user(target_id, ADMIN_REVOKE, None)
            .await?;

        Ok(json!({ "ok": true, "isBanned": true }))
    }

    pub async fn unban_user(
        &self,
        target_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        sqlx::query!(r#"DELETE FROM banned_users WHERE user_id = $1"#, target_id)
            .execute(&mut *tx)
            .await?;

        SecurityEvent::new(SecurityEventKind::AdminUserUnbanned)
            .user(target_id)
            .actor(admin_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true, "isBanned": false }))
    }

    /// Support for a user who lost both their authenticator and their
    /// recovery codes. The user is told by email, so a reset they did not ask
    /// for cannot go unnoticed.
    pub async fn reset_user_mfa(
        &self,
        target_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        let mut tx = self.db.begin().await?;

        if !disable_mfa(&mut tx, target_id).await? {
            return Err(AppError::bad_request(
                "Two-factor authentication is not enabled for this user.",
            ));
        }

        SecurityEvent::new(SecurityEventKind::AdminTwoFactorReset)
            .user(target_id)
            .actor(admin_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            target_id,
            SecurityNotice::TwoFactorResetBySupport,
        );

        Ok(json!({ "ok": true, "mfaEnabled": false }))
    }

    pub async fn delete_user(
        &self,
        target_id: Uuid,
        admin_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<Value> {
        if is_superadmin(&self.db, target_id).await? {
            return Err(AppError::forbidden("Admins cannot be deleted."));
        }

        let mut tx = self.db.begin().await?;

        let owns_group = sqlx::query_scalar!(
            r#"SELECT EXISTS (SELECT 1 FROM groups WHERE owner_id = $1) AS "exists!""#,
            target_id
        )
        .fetch_one(&mut *tx)
        .await?;

        if owns_group {
            return Err(AppError::bad_request(
                "User owns groups and cannot be deleted.",
            ));
        }

        let email = sqlx::query_scalar!(
            r#"DELETE FROM users WHERE id = $1 RETURNING email"#,
            target_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        // The address is all that still says whose account it was.
        SecurityEvent::new(SecurityEventKind::AdminUserDeleted)
            .user(target_id)
            .actor(admin_id)
            .client(client)
            .metadata(json!({ "email": email }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        Ok(json!({ "ok": true }))
    }
}

fn group_not_found() -> AppError {
    AppError::not_found("Group not found.")
}

/// Superadmins act with owner rights in every group, whether or not they are
/// a member, so the group's own moderation threshold never applies to them.
pub fn superadmin_caller(admin_id: Uuid) -> Caller {
    Caller {
        user_id: admin_id,
        is_superadmin: true,
        moderate_members_role: Role::User,
    }
}
