use super::{
    dto::{MfaSetupDto, MfaStatusDto, RecoveryCodesDto},
    recovery_codes::{self, RecoveryCodeHasher},
    totp::Totp,
};
use crate::{
    auth::{
        security_notice,
        service::security_changed,
        token::{MFA_CHANGE, TokenService},
    },
    common::{
        client::ClientInfo,
        email::{EmailService, SecurityNotice},
        encryption::EncryptionService,
        jwt::now_secs,
    },
    error::{AppError, AppResult, AuthFailure},
    realtime::event::publish,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

pub struct MfaService {
    db: PgPool,
    enc: EncryptionService,
    recovery_codes: RecoveryCodeHasher,
    email: EmailService,
    tokens: TokenService,
}

impl MfaService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            enc: state.encryption.clone(),
            recovery_codes: state.recovery_codes.clone(),
            email: state.email.clone(),
            tokens: TokenService::from_state(state),
        }
    }

    pub async fn get_status(&self, user_id: Uuid) -> AppResult<MfaStatusDto> {
        let user = sqlx::query!(r#"SELECT mfa_enabled FROM users WHERE id = $1"#, user_id)
            .fetch_optional(&self.db)
            .await?
            .ok_or_else(|| AppError::not_found("User not found."))?;

        let recovery_codes_left = if user.mfa_enabled {
            Some(recovery_codes::remaining(&self.db, user_id).await?)
        } else {
            None
        };

        Ok(MfaStatusDto {
            mfa_enabled: user.mfa_enabled,
            recovery_codes_left,
        })
    }

    pub async fn setup(&self, user_id: Uuid) -> AppResult<MfaSetupDto> {
        let user = sqlx::query!(
            r#"SELECT email, mfa_enabled FROM users WHERE id = $1"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        if user.mfa_enabled {
            return Err(AppError::bad_request("MFA is already enabled."));
        }

        let secret_b32 = Totp::generate_secret();

        let uid = user_id.to_string();

        let enc = self.enc.encrypt(&secret_b32, &uid).await?;

        let expires_at = chrono::Utc::now() + chrono::Duration::minutes(15);

        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"INSERT INTO mfa_pending_secrets (user_id, encrypted_secret, expires_at) VALUES ($1, $2, $3)
               ON CONFLICT (user_id) DO UPDATE
               SET encrypted_secret = $2, expires_at = $3, created_at = now()"#,
            user_id,
            enc.to_json(),
            expires_at,
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"INSERT INTO user_activity (user_id, type, meta) VALUES ($1, 'mfa:setup:started', '{}'::jsonb)"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let otpauth_url = Totp::from_base32(&secret_b32, &user.email)?.otpauth_url();

        Ok(MfaSetupDto {
            otpauth_url,
            secret: secret_b32,
            expires_at,
        })
    }

    /// Turns the factor on and hands out the recovery codes, which are shown
    /// this once. Every other session is signed out; the one that turned the
    /// factor on stays.
    pub async fn activate(
        &self,
        user_id: Uuid,
        session_id: Uuid,
        code: &str,
        client: &ClientInfo,
    ) -> AppResult<RecoveryCodesDto> {
        let pending = sqlx::query!(
            r#"SELECT p.encrypted_secret, u.email
               FROM mfa_pending_secrets p
               JOIN users u ON u.id = p.user_id
               WHERE p.user_id = $1 AND p.expires_at > now()"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(invalid_code)?;

        // The secret was only just shown to the signed-in user, so guessing a
        // code would gain nothing; the per-IP limit is enough here.
        let totp = Totp::from_stored(
            &self.enc,
            pending.encrypted_secret.clone(),
            user_id,
            &pending.email,
        )
        .await?;
        let step = totp
            .matching_step(code, now_secs())
            .ok_or_else(invalid_code)?;

        let mut tx = self.db.begin().await?;

        // The confirming code counts as used, so it cannot sign in afterwards.
        sqlx::query!(
            r#"UPDATE users
               SET mfa_enabled = true, mfa_secret = $2, mfa_last_used_step = $3,
                   mfa_failed_attempts = 0, mfa_locked_until = NULL
               WHERE id = $1"#,
            user_id,
            pending.encrypted_secret,
            step.as_db()
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"DELETE FROM mfa_pending_secrets WHERE user_id = $1"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        let codes = recovery_codes::replace(&mut tx, &self.recovery_codes, user_id).await?;

        SecurityEvent::new(SecurityEventKind::TwoFactorEnabled)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, MFA_CHANGE, Some(session_id))
            .await?;
        // Only once the other sessions are revoked, so their open streams
        // recheck them and end instead of seeing them still active.
        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user_id,
            SecurityNotice::TwoFactorEnabled,
        );

        Ok(RecoveryCodesDto {
            recovery_codes: codes,
        })
    }

    /// Replaces the recovery codes, e.g. once most are used up or the old ones
    /// may have been seen by someone else.
    pub async fn regenerate_recovery_codes(
        &self,
        user_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<RecoveryCodesDto> {
        let mut tx = self.db.begin().await?;

        let enabled = sqlx::query_scalar!(
            r#"SELECT mfa_enabled AND mfa_secret IS NOT NULL AS "enabled!"
               FROM users WHERE id = $1 FOR UPDATE"#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        if !enabled {
            return Err(AppError::bad_request("MFA is not enabled."));
        }

        let codes = recovery_codes::replace(&mut tx, &self.recovery_codes, user_id).await?;

        SecurityEvent::new(SecurityEventKind::RecoveryCodesRegenerated)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user_id,
            SecurityNotice::RecoveryCodesRegenerated,
        );

        Ok(RecoveryCodesDto {
            recovery_codes: codes,
        })
    }

    /// The caller has just confirmed who they are, which with the factor on
    /// already took the factor, so no further code is asked for.
    pub async fn deactivate(
        &self,
        user_id: Uuid,
        session_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        if !disable_mfa(&mut tx, user_id).await? {
            return Err(AppError::bad_request("MFA is not enabled."));
        }

        SecurityEvent::new(SecurityEventKind::TwoFactorDisabled)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, MFA_CHANGE, Some(session_id))
            .await?;
        // Only once the other sessions are revoked, so their open streams
        // recheck them and end instead of seeing them still active.
        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user_id,
            SecurityNotice::TwoFactorDisabled,
        );

        Ok(())
    }
}

/// Removes the second factor together with its recovery codes and attempt
/// state, so a factor set up later starts without inherited misses or a stale
/// last-used step. Returns whether the factor was on.
pub async fn disable_mfa(conn: &mut PgConnection, user_id: Uuid) -> AppResult<bool> {
    recovery_codes::delete_all(&mut *conn, user_id).await?;

    let was_enabled = sqlx::query!(
        r#"UPDATE users
           SET mfa_enabled = false, mfa_secret = NULL, mfa_failed_attempts = 0,
               mfa_locked_until = NULL, mfa_last_used_step = NULL
           WHERE id = $1 AND mfa_enabled
           RETURNING id"#,
        user_id
    )
    .fetch_optional(conn)
    .await?
    .is_some();

    Ok(was_enabled)
}

/// The code that confirms a new factor comes from a signed-in user, who must
/// not be sent to refresh their session, so this is no 401.
fn invalid_code() -> AppError {
    AuthFailure::InvalidSecondFactor.into()
}
