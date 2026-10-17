use super::service::security_changed;
use crate::{
    access_control,
    common::{
        client::ClientInfo,
        jwt::{AccessClaims, JwtService},
    },
    config::{ACCESS_TOKEN_TTL, REFRESH_REUSE_GRACE, REFRESH_TOKEN_TTL, chrono_ttl},
    error::AppError,
    realtime::event::publish,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use chrono::{DateTime, Utc};
use ipnetwork::IpNetwork;
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

pub type RevokeReason = &'static str;
pub const LOGOUT: RevokeReason = "logout";
pub const LOGOUT_ALL: RevokeReason = "logout_all";
pub const REUSE_DETECTED: RevokeReason = "reuse_detected";
pub const PASSWORD_CHANGE: RevokeReason = "password_change";
pub const ADMIN_REVOKE: RevokeReason = "admin_revoke";
pub const ACCOUNT_DELETED: RevokeReason = "account_deleted";
pub const MFA_CHANGE: RevokeReason = "mfa_change";
/// The user ended one of their sessions from the session list.
pub const SESSION_REVOKED: RevokeReason = "session_revoked";
const SESSION_LIMIT: RevokeReason = "session_limit";
const MAX_SESSIONS_PER_USER: i64 = 10;

/// Why a refresh bought no new session. Each one signs the client out, so the
/// reason is logged for whoever has to explain an unexpected sign-out.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefreshRejection {
    /// The request carried no refresh cookie.
    Missing,
    /// No such token was issued, or it was cleaned up long ago.
    Unknown,
    Expired,
    /// The session was ended (logout, password change, session limit, ...).
    Revoked,
    /// Replayed after rotation outside the grace window, so treated as theft.
    Reused,
    AccountInactive,
}

#[derive(Debug)]
pub struct IssuedTokens {
    pub access_token: String,
    pub refresh_token: String,
}

pub struct IssueTokenParams<'a> {
    pub user_id: Uuid,
    pub email: &'a str,
    pub client: &'a ClientInfo,
    pub origin: SessionOrigin,
}

/// Whether a token pair starts a session or continues one.
pub enum SessionOrigin {
    /// The user just signed in.
    SignIn,
    /// A refresh: the pair joins its parent's family and keeps the time the
    /// user last authenticated, so staying signed in never counts as signing
    /// in again.
    Rotation {
        parent_id: Uuid,
        family_id: Uuid,
        authenticated_at: DateTime<Utc>,
    },
}

struct RefreshTokenRow {
    id: Uuid,
    user_id: Uuid,
    family_id: Uuid,
    used_at: Option<DateTime<Utc>>,
    revoked_at: Option<DateTime<Utc>>,
    expires_at: DateTime<Utc>,
    authenticated_at: DateTime<Utc>,
}

impl RefreshTokenRow {
    fn used_within_reuse_grace(&self) -> bool {
        self.used_at
            .is_some_and(|used_at| Utc::now() - used_at <= chrono_ttl(REFRESH_REUSE_GRACE))
    }

    /// Why presenting this token again ends its session, if it does.
    fn replay_rejection(&self) -> Option<RefreshRejection> {
        if self.revoked_at.is_some() {
            Some(RefreshRejection::Revoked)
        } else if self.used_within_reuse_grace() {
            None
        } else {
            Some(RefreshRejection::Reused)
        }
    }
}

pub struct TokenService {
    pub db: PgPool,
    pub jwt: JwtService,
    pub geoip_url: String,
    pub http: reqwest::Client,
}

fn hash_token(token: &str) -> String {
    let mut h = Sha256::new();

    h.update(token.as_bytes());

    hex::encode(h.finalize())
}

fn generate_opaque_token() -> String {
    use base64::prelude::*;

    BASE64_URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>())
}

impl TokenService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            jwt: state.jwt.clone(),
            geoip_url: state.config.geoip_service_url.clone(),
            http: state.http.clone(),
        }
    }

    pub async fn issue_pair(&self, p: IssueTokenParams<'_>) -> Result<IssuedTokens, AppError> {
        let (family_id, parent_id, authenticated_at) = match p.origin {
            SessionOrigin::SignIn => {
                // Every sign-in, whatever its method, ends here, so no new
                // session can start during shutdown.
                access_control::ensure_admitted(&self.db, p.user_id).await?;
                self.make_room_for_new_session(p.user_id).await?;
                (Uuid::new_v4(), None, Utc::now())
            }
            SessionOrigin::Rotation {
                parent_id,
                family_id,
                authenticated_at,
            } => (family_id, Some(parent_id), authenticated_at),
        };

        let refresh_token = generate_opaque_token();

        let token_hash = hash_token(&refresh_token);

        let expires_at = Utc::now() + chrono_ttl(REFRESH_TOKEN_TTL);

        sqlx::query!(
            r#"INSERT INTO refresh_tokens
                (user_id, token_hash, family_id, parent_id, expires_at,
                 user_agent, ip_address, authenticated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
            p.user_id,
            token_hash,
            family_id,
            parent_id,
            expires_at,
            p.client.user_agent.as_deref(),
            p.client.ip.map(IpNetwork::from),
            authenticated_at,
        )
        .execute(&self.db)
        .await?;

        let access_token = self.sign_access(p.user_id, p.email, family_id, authenticated_at)?;

        Ok(IssuedTokens {
            access_token,
            refresh_token,
        })
    }

    fn sign_access(
        &self,
        user_id: Uuid,
        email: &str,
        session_id: Uuid,
        authenticated_at: DateTime<Utc>,
    ) -> Result<String, AppError> {
        let claims = AccessClaims::new(
            user_id,
            email.to_owned(),
            session_id,
            authenticated_at,
            ACCESS_TOKEN_TTL,
        );

        self.jwt
            .sign_access(&claims)
            .map_err(|e| AppError::internal(format!("Failed to sign access token: {e}")))
    }

    /// Records that the user just proved who they are in this session and
    /// returns an access token that says so. Refreshes carry the time over, so
    /// every tab of the session counts as confirmed.
    pub async fn confirm_identity(
        &self,
        user_id: Uuid,
        email: &str,
        session_id: Uuid,
    ) -> Result<String, AppError> {
        let authenticated_at = sqlx::query_scalar!(
            r#"UPDATE refresh_tokens SET authenticated_at = now()
               WHERE family_id = $1 AND user_id = $2 AND revoked_at IS NULL
               RETURNING authenticated_at"#,
            session_id,
            user_id
        )
        .fetch_all(&self.db)
        .await?
        .into_iter()
        .max()
        .ok_or(AppError::TokenExpired)?;

        self.sign_access(user_id, email, session_id, authenticated_at)
    }

    /// A session is a token family, not a row: parallel refreshes leave unused
    /// sibling tokens behind, and counting those would evict real sessions.
    /// Families are ranked by their newest token, which every refresh renews,
    /// so the least recently used sessions go first.
    async fn make_room_for_new_session(&self, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query!(
            r#"UPDATE refresh_tokens
               SET revoked_at = now(), revoked_reason = $1
               WHERE user_id = $2
                 AND revoked_at IS NULL
                 AND family_id IN (
                     SELECT family_id FROM refresh_tokens
                     WHERE user_id = $2
                       AND revoked_at IS NULL
                       AND used_at IS NULL
                       AND expires_at > now()
                     GROUP BY family_id
                     ORDER BY max(last_used_at) DESC
                     OFFSET $3
                 )"#,
            SESSION_LIMIT,
            user_id,
            MAX_SESSIONS_PER_USER - 1,
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn rotate(
        &self,
        presented_token: &str,
        client: &ClientInfo,
    ) -> Result<Result<IssuedTokens, RefreshRejection>, AppError> {
        let hash = hash_token(presented_token);

        let Some(row) = self.find_refresh_token(&hash).await? else {
            return Ok(Err(RefreshRejection::Unknown));
        };

        if row.expires_at < Utc::now() {
            return Ok(Err(RefreshRejection::Expired));
        }

        // Refused before the token is consumed, so the session is still there
        // once shutdown ends.
        access_control::ensure_admitted(&self.db, row.user_id).await?;

        let consumed = sqlx::query!(
            r#"UPDATE refresh_tokens SET used_at = now()
               WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL
               RETURNING id"#,
            row.id
        )
        .fetch_optional(&self.db)
        .await?
        .is_some();

        if !consumed {
            // Re-read so a concurrent consume or revoke is judged on current state.
            let Some(current) = self.find_refresh_token(&hash).await? else {
                return Ok(Err(RefreshRejection::Unknown));
            };

            // Parallel refreshes (several tabs, a reload racing an in-flight
            // refresh) legitimately present the same token moments apart and get
            // a sibling pair in the same family. Only a replay outside the grace
            // window, or of a revoked token, is treated as theft.
            if let Some(rejection) = current.replay_rejection() {
                if rejection == RefreshRejection::Reused {
                    tracing::warn!(
                        "Refresh token reuse detected for user {}, family {}",
                        current.user_id,
                        current.family_id
                    );
                    SecurityEvent::new(SecurityEventKind::RefreshTokenReused)
                        .user(current.user_id)
                        .client(client)
                        .metadata(json!({ "sessionId": current.family_id }))
                        .record(&self.db)
                        .await?;
                }

                self.revoke_family(current.family_id, REUSE_DETECTED)
                    .await?;
                // Ends the stolen session's open event streams as well.
                publish(&self.db, [security_changed(current.user_id)]).await?;

                return Ok(Err(rejection));
            }
        }

        let Some(user) = self.load_active_user(row.user_id).await? else {
            self.revoke_family(row.family_id, ADMIN_REVOKE).await?;
            return Ok(Err(RefreshRejection::AccountInactive));
        };

        let issued = self
            .issue_pair(IssueTokenParams {
                user_id: user.user_id,
                email: &user.email,
                client,
                origin: SessionOrigin::Rotation {
                    parent_id: row.id,
                    family_id: row.family_id,
                    authenticated_at: row.authenticated_at,
                },
            })
            .await?;

        Ok(Ok(issued))
    }

    async fn find_refresh_token(&self, hash: &str) -> Result<Option<RefreshTokenRow>, AppError> {
        Ok(sqlx::query_as!(
            RefreshTokenRow,
            r#"SELECT id, user_id, family_id, used_at, revoked_at, expires_at, authenticated_at
               FROM refresh_tokens WHERE token_hash = $1"#,
            hash
        )
        .fetch_optional(&self.db)
        .await?)
    }

    pub async fn revoke_family(
        &self,
        family_id: Uuid,
        reason: RevokeReason,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $1
               WHERE family_id = $2 AND revoked_at IS NULL"#,
            reason,
            family_id,
        )
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Ends one of the user's own sessions. `false` when no live session of
    /// theirs has that id.
    pub async fn revoke_own_session(
        &self,
        user_id: Uuid,
        family_id: Uuid,
        reason: RevokeReason,
    ) -> Result<bool, AppError> {
        let revoked = sqlx::query!(
            r#"UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $1
               WHERE family_id = $2 AND user_id = $3 AND revoked_at IS NULL"#,
            reason,
            family_id,
            user_id,
        )
        .execute(&self.db)
        .await?
        .rows_affected();

        Ok(revoked > 0)
    }

    /// Ends the session the token belongs to and returns whose it was, or
    /// `None` when it had already ended.
    pub async fn revoke_current_family(
        &self,
        token: &str,
        reason: RevokeReason,
    ) -> Result<Option<Uuid>, AppError> {
        let hash = hash_token(token);

        let Some(row) = sqlx::query!(
            r#"SELECT user_id, family_id FROM refresh_tokens
               WHERE token_hash = $1 AND revoked_at IS NULL"#,
            hash
        )
        .fetch_optional(&self.db)
        .await?
        else {
            return Ok(None);
        };

        self.revoke_family(row.family_id, reason).await?;

        Ok(Some(row.user_id))
    }

    pub async fn revoke_all_for_user(
        &self,
        user_id: Uuid,
        reason: RevokeReason,
        except_family: Option<Uuid>,
    ) -> Result<(), AppError> {
        if let Some(except) = except_family {
            sqlx::query!(
                r#"UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $1
                   WHERE user_id = $2 AND revoked_at IS NULL AND family_id != $3"#,
                reason,
                user_id,
                except,
            )
            .execute(&self.db)
            .await?;
        } else {
            sqlx::query!(
                r#"UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $1
                   WHERE user_id = $2 AND revoked_at IS NULL"#,
                reason,
                user_id,
            )
            .execute(&self.db)
            .await?;
        }
        Ok(())
    }

    pub async fn list_active_sessions(&self, user_id: Uuid) -> Result<Vec<SessionInfo>, AppError> {
        let rows = sqlx::query!(
            r#"SELECT DISTINCT ON (family_id)
                      family_id, issued_at, last_used_at, user_agent,
                      host(ip_address) as ip_address
               FROM refresh_tokens
               WHERE user_id = $1
                 AND revoked_at IS NULL
                 AND used_at IS NULL
                 AND expires_at > now()
               ORDER BY family_id, last_used_at DESC"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let mut rows = rows;
        rows.sort_by_key(|r| std::cmp::Reverse(r.last_used_at));

        let mut sessions = Vec::with_capacity(rows.len());

        for row in rows {
            let location = if let Some(ip) = row.ip_address.as_deref() {
                self.lookup_ip(ip).await
            } else {
                None
            };

            sessions.push(SessionInfo {
                family_id: row.family_id,
                issued_at: row.issued_at,
                last_used_at: row.last_used_at,
                user_agent: row.user_agent,
                ip_address: row.ip_address,
                location,
            });
        }

        Ok(sessions)
    }

    pub async fn get_current_family_id(&self, token: &str) -> Result<Option<Uuid>, AppError> {
        let hash = hash_token(token);

        let row = sqlx::query!(
            r#"SELECT family_id FROM refresh_tokens WHERE token_hash = $1"#,
            hash
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(row.map(|r| r.family_id))
    }

    async fn lookup_ip(&self, ip: &str) -> Option<IpLocation> {
        let clean_ip = ip.split('/').next().unwrap_or(ip);

        let url = format!("{}/lookup/{}", self.geoip_url, clean_ip);

        let resp = self
            .http
            .get(&url)
            .timeout(std::time::Duration::from_millis(500))
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() {
            return None;
        }

        let data: serde_json::Value = resp.json().await.ok()?;

        Some(IpLocation {
            city: data["city"].as_str().map(String::from),
            country: data["country"].as_str().map(String::from),
            country_code: data["country_code"].as_str().map(String::from),
        })
    }

    /// A deleted or banned user gets no new tokens.
    async fn load_active_user(&self, user_id: Uuid) -> Result<Option<ActiveUser>, AppError> {
        let user = sqlx::query!(r#"SELECT id, email FROM users WHERE id = $1"#, user_id)
            .fetch_optional(&self.db)
            .await?;

        let user = match user {
            None => return Ok(None),
            Some(u) => u,
        };

        let ban = sqlx::query!(r#"SELECT id FROM banned_users WHERE user_id = $1"#, user_id)
            .fetch_optional(&self.db)
            .await?;

        if ban.is_some() {
            return Ok(None);
        }

        Ok(Some(ActiveUser {
            user_id: user.id,
            email: user.email,
        }))
    }
}

#[derive(Debug)]
struct ActiveUser {
    user_id: Uuid,
    email: String,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub family_id: Uuid,
    pub issued_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub location: Option<IpLocation>,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IpLocation {
    pub city: Option<String>,
    pub country: Option<String>,
    pub country_code: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn consumed_token(used_ago: chrono::TimeDelta, revoked: bool) -> RefreshTokenRow {
        let now = Utc::now();
        RefreshTokenRow {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            family_id: Uuid::new_v4(),
            used_at: Some(now - used_ago),
            revoked_at: revoked.then_some(now),
            expires_at: now + chrono_ttl(REFRESH_TOKEN_TTL),
            authenticated_at: now - chrono::TimeDelta::days(1),
        }
    }

    #[test]
    fn a_parallel_refresh_within_the_grace_window_is_no_replay() {
        let token = consumed_token(chrono::TimeDelta::seconds(1), false);
        assert_eq!(token.replay_rejection(), None);
    }

    #[test]
    fn a_replay_after_the_grace_window_counts_as_reuse() {
        let late = chrono_ttl(REFRESH_REUSE_GRACE) + chrono::TimeDelta::seconds(1);
        let token = consumed_token(late, false);
        assert_eq!(token.replay_rejection(), Some(RefreshRejection::Reused));
    }

    #[test]
    fn a_revoked_token_is_refused_even_within_the_grace_window() {
        let token = consumed_token(chrono::TimeDelta::seconds(1), true);
        assert_eq!(token.replay_rejection(), Some(RefreshRejection::Revoked));
    }
}
