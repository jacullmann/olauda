use crate::{
    access_control,
    auth::{
        cookies::*,
        dto::*,
        email_code::{self, EmailCode, Issuance},
        email_verification::{self, SignUp},
        password_attempts, security_notice,
        session_context::is_superadmin,
        sign_in_methods::{SignInMethod, SignInMethods},
        token::{IssueTokenParams, SessionOrigin, TokenService, *},
    },
    common::{
        client::ClientInfo,
        csrf::generate_csrf_token,
        email::{EmailService, SecurityNotice},
        jwt::JwtService,
        locale::Locale,
        password::{hash_password, validate_password_strength, verify_password},
        role::Role,
    },
    config::{Config, MFA_PENDING_TTL, PASSWORD_RESET_TTL},
    error::{AppError, AppResult, AuthFailure},
    mfa::{
        recovery_codes::RecoveryCodeHasher,
        second_factor::{self, CodeCheck, SecondFactorKeys, SecondFactorProof, Verified},
    },
    realtime::event::{AccountTopic, Notice, publish},
    reauth::service::confirm_password,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
    user::dto::{CourseSelectionDto, PreferencesDto},
};
use axum_extra::extract::cookie::CookieJar;
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

const DUMMY_PASSWORD_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$ptEx1UyXW3Vbni4hpQoKFA$CEEsGfXo9ruOgOAeAN4ZGpLiQK8gS+st5w9rVUimJlA";

struct PasswordlessAccount {
    email: String,
    locale: Locale,
}

/// Which second factor completed a sign-in, as the security log records it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecondFactorKind {
    AuthenticatorApp,
    RecoveryCode,
    Passkey,
}

impl SecondFactorKind {
    const fn as_str(self) -> &'static str {
        match self {
            Self::AuthenticatorApp => "authenticator_app",
            Self::RecoveryCode => "recovery_code",
            Self::Passkey => "passkey",
        }
    }
}

pub struct AuthService {
    db: PgPool,
    tokens: TokenService,
    email: EmailService,
    jwt: JwtService,
    config: std::sync::Arc<Config>,
    enc: crate::common::encryption::EncryptionService,
    recovery_codes: RecoveryCodeHasher,
}

impl AuthService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            tokens: TokenService::from_state(state),
            email: state.email.clone(),
            jwt: state.jwt.clone(),
            config: state.config.clone(),
            enc: state.encryption.clone(),
            recovery_codes: state.recovery_codes.clone(),
        }
    }

    async fn issue_session(
        &self,
        conn: &mut PgConnection,
        user_id: Uuid,
        email: &str,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        let opts = self.config.base_cookie_options();

        let issued = self
            .tokens
            .issue_pair(
                conn,
                IssueTokenParams {
                    user_id,
                    email,
                    client,
                    origin: SessionOrigin::SignIn,
                },
            )
            .await?;

        let csrf = generate_csrf_token();

        let jar = CookieJar::new()
            .add(access_cookie(issued.access_token, &opts))
            .add(refresh_cookie(issued.refresh_token, &opts))
            .add(crate::common::csrf::csrf_cookie(&csrf, &opts));

        Ok(jar)
    }

    async fn equalize_login_timing(&self, password: String) {
        let _ = verify_password(password, DUMMY_PASSWORD_HASH.to_string()).await;
    }

    /// No account has the address. Whoever signed up with it and entered the
    /// same password is told to confirm it first; anyone else learns nothing.
    /// Only the latest sign-up is checked, so this costs one hash like any
    /// other failed sign-in.
    async fn reject_unknown_sign_in(&self, email: &str, password: String) -> AppError {
        let pending = match email_verification::latest_password_hash(&self.db, email).await {
            Ok(pending) => pending,
            Err(e) => return e,
        };

        let Some(hash) = pending else {
            self.equalize_login_timing(password).await;
            return AuthFailure::InvalidCredentials.into();
        };

        match verify_password(password, hash).await {
            Ok(true) => AuthFailure::EmailNotVerified.into(),
            Ok(false) => AuthFailure::InvalidCredentials.into(),
            Err(e) => e,
        }
    }

    pub async fn login(&self, dto: LoginDto, client: &ClientInfo) -> AppResult<LoginResult> {
        let email = dto.email.to_lowercase();

        access_control::ensure_email_admitted(&self.db, &email).await?;

        let user = sqlx::query!(
            r#"
            SELECT id, email, password_hash,
                   mfa_enabled AND mfa_secret IS NOT NULL AS "mfa_required!"
            FROM users WHERE email = $1
            "#,
            email
        )
        .fetch_optional(&self.db)
        .await?;

        let Some(user) = user else {
            let rejection = self.reject_unknown_sign_in(&email, dto.password).await;
            // The attempted address is left out: it is often a mistyped one
            // of someone else, and the address the attempts come from is what
            // reveals credential stuffing.
            SecurityEvent::new(SecurityEventKind::SignInFailed)
                .client(client)
                .metadata(json!({ "reason": "unknown_account" }))
                .record(&self.db)
                .await?;
            return Err(rejection);
        };

        let Some(hash) = user.password_hash else {
            self.equalize_login_timing(dto.password).await;
            SecurityEvent::new(SecurityEventKind::SignInFailed)
                .user(user.id)
                .client(client)
                .metadata(json!({ "reason": "no_password" }))
                .record(&self.db)
                .await?;
            return Err(AuthFailure::InvalidCredentials.into());
        };

        let attempt = password_attempts::reserve(&self.db, user.id).await?;

        if !verify_password(dto.password, hash).await? {
            return Err(attempt.reject(&self.db, client).await);
        }
        attempt.accept(&self.db).await?;

        self.complete_sign_in(
            user.id,
            &user.email,
            user.mfa_required,
            SignInMethod::Password,
            client,
        )
        .await
    }

    /// The one gate every sign-in passes once its first factor (password or
    /// Google) is verified, so no entry point can skip the ban check or the
    /// second factor.
    pub async fn complete_sign_in(
        &self,
        user_id: Uuid,
        email: &str,
        mfa_required: bool,
        method: SignInMethod,
        client: &ClientInfo,
    ) -> AppResult<LoginResult> {
        let banned = sqlx::query_scalar!(
            r#"SELECT EXISTS (SELECT 1 FROM banned_users WHERE user_id = $1) AS "banned!""#,
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        if banned {
            SecurityEvent::new(SecurityEventKind::SignInFailed)
                .user(user_id)
                .client(client)
                .metadata(json!({ "reason": "banned", "method": method.as_str() }))
                .record(&self.db)
                .await?;
            return Err(AppError::Forbidden(
                "Your account has been suspended.".into(),
            ));
        }

        // Starting a session refuses it as well; checking here spares the
        // user a second factor that could not get them in.
        access_control::ensure_admitted(&self.db, user_id).await?;

        if mfa_required {
            let mfa_token = self
                .jwt
                .sign_mfa_pending(user_id, email, MFA_PENDING_TTL)
                .map_err(|e| AppError::internal(e.to_string()))?;

            let opts = self.config.base_cookie_options();

            return Ok(LoginResult::MfaRequired(
                CookieJar::new().add(mfa_pending_cookie(mfa_token, &opts)),
            ));
        }

        self.start_session(user_id, email, method, client)
            .await
            .map(LoginResult::Success)
    }

    /// Signs in an account that owes no second factor.
    async fn start_session(
        &self,
        user_id: Uuid,
        email: &str,
        method: SignInMethod,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        self.open_session(user_id, email, json!({ "method": method.as_str() }), client)
            .await
    }

    /// Records the sign-in and issues its session in one transaction, so a
    /// session never exists without its entry in the security log.
    async fn open_session(
        &self,
        user_id: Uuid,
        email: &str,
        sign_in: serde_json::Value,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"UPDATE users SET last_login_at = now() WHERE id = $1"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"DELETE FROM mfa_pending_secrets WHERE user_id = $1"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        let jar = self.issue_session(&mut tx, user_id, email, client).await?;

        SecurityEvent::new(SecurityEventKind::SignIn)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(sign_in)
            .record(&mut *tx)
            .await?;

        // The account's other devices list the new session.
        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        Ok(jar)
    }

    /// Finishes a sign-in with the second factor. Returns how many recovery
    /// codes are left when one was used, so the client can warn early.
    pub async fn verify_mfa(
        &self,
        proof: &SecondFactorProof,
        user_id: Uuid,
        email: &str,
        client: &ClientInfo,
    ) -> AppResult<(CookieJar, Option<usize>)> {
        let check =
            second_factor::check(&self.db, self.second_factor_keys(), user_id, proof, client)
                .await?;
        let CodeCheck::Accepted(verified) = check else {
            return Err(AuthFailure::InvalidSecondFactor.into());
        };

        let kind = match verified {
            Verified::AuthenticatorApp => SecondFactorKind::AuthenticatorApp,
            Verified::RecoveryCode { .. } => SecondFactorKind::RecoveryCode,
        };
        let jar = self
            .finish_two_factor_sign_in(user_id, email, kind, client)
            .await?;

        let recovery_codes_left = match verified {
            Verified::AuthenticatorApp => None,
            Verified::RecoveryCode { remaining } => Some(remaining),
        };
        if let Some(event) = verified.security_notice() {
            security_notice::notify(&self.db, &self.email, user_id, event);
        }

        Ok((jar, recovery_codes_left))
    }

    /// Issues the session for a sign-in whose second factor, of any kind, has
    /// just been verified, and drops the pending challenge.
    pub async fn finish_two_factor_sign_in(
        &self,
        user_id: Uuid,
        email: &str,
        kind: SecondFactorKind,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        let jar = self
            .open_session(
                user_id,
                email,
                json!({ "secondFactor": kind.as_str() }),
                client,
            )
            .await?;

        let opts = self.config.base_cookie_options();
        Ok(jar.add(clear_mfa_pending_cookie(&opts)))
    }

    fn second_factor_keys(&self) -> SecondFactorKeys<'_> {
        SecondFactorKeys {
            encryption: &self.enc,
            recovery_codes: &self.recovery_codes,
        }
    }

    /// Stores the sign-up and mails its confirmation code. The account is
    /// only created once the code is entered with this password (see
    /// [`email_verification`]), so signing up again, by anyone, leaves every
    /// earlier sign-up for the address as it was.
    pub async fn register(&self, dto: RegisterDto) -> AppResult<()> {
        access_control::ensure_registration_open(&self.db).await?;
        validate_password_strength(&dto.password).map_err(|e| AppError::BadRequest(e.into()))?;

        let email = dto.email.to_lowercase();
        let locale = dto.preferences.language;
        let sign_up = SignUp {
            password_hash: hash_password(dto.password).await?,
            preferences: json!(dto.preferences),
        };

        let mut tx = self.db.begin().await?;
        email_code::lock_address(&mut tx, &email).await?;

        let registered = sqlx::query_scalar!(
            r#"SELECT EXISTS (SELECT 1 FROM users WHERE email = $1) AS "registered!""#,
            email
        )
        .fetch_one(&mut *tx)
        .await?;

        if registered {
            return Err(AuthFailure::EmailAlreadyRegistered.into());
        }

        let code = match email_verification::issue(&mut tx, &email, &sign_up).await? {
            Issuance::Issued(code) => code,
            Issuance::Throttled { retry_after } => {
                return Err(AppError::EmailCodeThrottled { retry_after });
            }
        };

        tx.commit().await?;

        // The sign-up is stored either way; the user can have the code resent.
        if let Err(e) = self
            .email
            .send_verification_email(&email, locale, &code)
            .await
        {
            tracing::warn!("Confirmation email not sent: {e}");
        }

        Ok(())
    }

    /// Mails a new code for the latest sign-up of the address. The answer is
    /// the same whether or not one was sent, so it reveals nothing about it.
    pub async fn resend_verification(&self, email: &str) -> AppResult<()> {
        access_control::ensure_registration_open(&self.db).await?;
        let email = email.to_lowercase();

        let mut tx = self.db.begin().await?;
        email_code::lock_address(&mut tx, &email).await?;

        if let Some(resent) = email_verification::reissue_latest(&mut tx, &email).await? {
            tx.commit().await?;
            let locale = Locale::from_stored(resent.language.as_deref());
            if let Err(e) = self
                .email
                .send_verification_email(&email, locale, &resent.code)
                .await
            {
                tracing::warn!("Confirmation email not resent: {e}");
            }
        }

        Ok(())
    }

    pub async fn get_me(&self, user_id: Uuid) -> AppResult<Option<CurrentUserDto>> {
        let user = sqlx::query!(
            r#"
            SELECT id, email, mfa_enabled, personalized, preferences,
                   password_hash IS NOT NULL AS "has_password!"
            FROM users WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        let Some(user) = user else {
            return Ok(None);
        };

        let global_role = if is_superadmin(&self.db, user_id).await? {
            Role::Superadmin
        } else {
            Role::User
        };

        let courses = sqlx::query_as!(
            CourseSelectionDto,
            r#"SELECT subject_id, course_id FROM user_courses WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(Some(CurrentUserDto {
            username: crate::common::name_generator::generate_user_name(&user.id.to_string()),
            id: user.id,
            email: user.email,
            role: global_role,
            courses,
            personalized: user.personalized,
            mfa_enabled: user.mfa_enabled,
            has_password: user.has_password,
            preferences: PreferencesDto::from_stored(user.preferences),
        }))
    }

    pub async fn delete_me(&self, user_id: Uuid, client: &ClientInfo) -> AppResult<CookieJar> {
        let roles = sqlx::query!(
            r#"
            SELECT r.name FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        if roles.iter().any(|r| r.name == "superadmin") {
            return Err(AppError::Forbidden(
                "Admin accounts cannot be deleted.".into(),
            ));
        }

        let owned = sqlx::query!(
            r#"SELECT id FROM groups WHERE owner_id = $1 LIMIT 1"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        if owned.is_some() {
            return Err(AppError::BadRequest(
                "You own at least one group. Transfer or delete the group before deleting your account.".into(),
            ));
        }

        let mut tx = self.db.begin().await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, ACCOUNT_DELETED, None)
            .await?;

        sqlx::query!(r#"DELETE FROM users WHERE id = $1"#, user_id)
            .execute(&mut *tx)
            .await?;

        SecurityEvent::new(SecurityEventKind::AccountDeleted)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        let opts = self.config.base_cookie_options();

        let jar = CookieJar::new()
            .add(clear_access_cookie(&opts))
            .add(clear_refresh_cookie(&opts))
            .add(clear_mfa_pending_cookie(&opts));

        Ok(jar)
    }

    /// Creates the account of a sign-up from its code and the password it
    /// chose, and signs the new account in. Paused sign-ups hold back codes
    /// mailed before the pause as well; those still unexpired work once it
    /// ends.
    pub async fn confirm_sign_up(
        &self,
        email: &str,
        code: &EmailCode,
        password: String,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        access_control::ensure_registration_open(&self.db).await?;
        let email = email.to_lowercase();
        let invalid_code = || AppError::bad_request("Invalid or expired code.");

        let pending = email_verification::redeem(&self.db, &email, code)
            .await?
            .ok_or_else(invalid_code)?;

        if !verify_password(password, pending.sign_up.password_hash.clone()).await? {
            return Err(AuthFailure::IncorrectPassword.into());
        }

        let mut tx = self.db.begin().await?;
        email_code::lock_address(&mut tx, &email).await?;

        if !email_verification::settle(&mut tx, &email, pending.id).await? {
            return Err(invalid_code());
        }

        let user_id = sqlx::query_scalar!(
            r#"INSERT INTO users (email, password_hash, preferences)
               VALUES ($1, $2, $3)
               RETURNING id"#,
            email,
            pending.sign_up.password_hash,
            pending.sign_up.preferences,
        )
        .fetch_one(&mut *tx)
        .await
        // A Google sign-up for the address may have come first.
        .map_err(|e| match e.as_database_error() {
            Some(db) if db.is_unique_violation() => {
                AppError::from(AuthFailure::EmailAlreadyRegistered)
            }
            _ => AppError::Database(e),
        })?;

        SecurityEvent::new(SecurityEventKind::AccountCreated)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(json!({ "method": SignInMethod::Password.as_str() }))
            .record(&mut *tx)
            .await?;

        tx.commit().await?;

        // A new account has no second factor and cannot have been banned yet.
        self.start_session(user_id, &email, SignInMethod::Password, client)
            .await
    }

    pub async fn forgot_password(&self, email: &str, client: &ClientInfo) -> AppResult<()> {
        let email = email.to_lowercase();

        let user = sqlx::query!(
            r#"SELECT id, preferences->>'language' AS language FROM users WHERE email = $1"#,
            email
        )
        .fetch_optional(&self.db)
        .await?;

        // A throttled address gets the same answer as any other: a different
        // one would reveal that it has an account.
        if let Some(user) = user {
            let issuance = email_code::issue(&self.db, &email).await?;

            SecurityEvent::new(SecurityEventKind::PasswordResetRequested)
                .user(user.id)
                .client(client)
                .metadata(json!({ "codeSent": matches!(issuance, Issuance::Issued(_)) }))
                .record(&self.db)
                .await?;

            if let Issuance::Issued(code) = issuance {
                let locale = Locale::from_stored(user.language.as_deref());
                let _ = self
                    .email
                    .send_password_reset_email(&email, locale, &code)
                    .await;
            }
        }

        Ok(())
    }

    pub async fn verify_reset_token(&self, email: &str, code: &EmailCode) -> AppResult<String> {
        let email = email.to_lowercase();

        email_code::redeem(&self.db, &email, code).await?;

        let current_hash =
            sqlx::query_scalar!(r#"SELECT password_hash FROM users WHERE email = $1"#, email)
                .fetch_optional(&self.db)
                .await?
                .ok_or_else(|| AppError::BadRequest("Invalid code.".into()))?;

        let reset_token = self
            .jwt
            .sign_password_reset(
                &email,
                password_fingerprint(current_hash.as_deref()),
                PASSWORD_RESET_TTL,
            )
            .map_err(|e| AppError::internal(e.to_string()))?;

        Ok(reset_token)
    }

    pub async fn request_password_setup_code(&self, user_id: Uuid) -> AppResult<()> {
        let account = self.passwordless_account(user_id).await?;

        let code = match email_code::issue(&self.db, &account.email).await? {
            Issuance::Issued(code) => code,
            Issuance::Throttled { retry_after } => {
                return Err(AppError::EmailCodeThrottled { retry_after });
            }
        };

        self.email
            .send_password_setup_email(&account.email, account.locale, &code)
            .await?;

        Ok(())
    }

    /// Unlike a reset this leaves MFA untouched and signs the caller straight
    /// back in: they are already authenticated, and the email code proves
    /// the same as a reset would.
    pub async fn set_initial_password(
        &self,
        user_id: Uuid,
        code: &EmailCode,
        new_password: String,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        validate_password_strength(&new_password).map_err(|e| AppError::BadRequest(e.into()))?;

        let email = self.passwordless_account(user_id).await?.email;

        email_code::redeem(&self.db, &email, code).await?;

        let hash = hash_password(new_password).await?;

        let mut tx = self.db.begin().await?;

        // The IS NULL guard keeps a concurrent request from overwriting a
        // password that was set in the meantime.
        let updated = sqlx::query!(
            r#"UPDATE users
               SET password_hash = $1, password_failed_attempts = 0, password_locked_until = NULL
               WHERE id = $2 AND password_hash IS NULL"#,
            hash,
            user_id
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if updated == 0 {
            return Err(AppError::bad_request(
                "Your account already has a password.",
            ));
        }

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, PASSWORD_CHANGE, None)
            .await?;

        let jar = self.issue_session(&mut tx, user_id, &email, client).await?;

        SecurityEvent::new(SecurityEventKind::PasswordSet)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(&self.db, &self.email, user_id, SecurityNotice::PasswordSet);

        Ok(jar)
    }

    async fn passwordless_account(&self, user_id: Uuid) -> AppResult<PasswordlessAccount> {
        let user = sqlx::query!(
            r#"SELECT email, password_hash IS NOT NULL AS "has_password!",
                      preferences->>'language' AS language
               FROM users WHERE id = $1"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        if user.has_password {
            return Err(AppError::bad_request(
                "Your account already has a password.",
            ));
        }

        Ok(PasswordlessAccount {
            email: user.email,
            locale: Locale::from_stored(user.language.as_deref()),
        })
    }

    /// Sets a new password with a token from [`Self::verify_reset_token`].
    ///
    /// A reset proves control of the mailbox and nothing more, so it replaces
    /// only the password: two-factor authentication and passkeys stay, and an
    /// account with a second factor still needs it to sign in afterwards.
    /// Every session ends.
    pub async fn reset_password(
        &self,
        reset_token: &str,
        password: &str,
        client: &ClientInfo,
    ) -> AppResult<()> {
        validate_password_strength(password).map_err(|e| AppError::BadRequest(e.into()))?;

        let claims = self.jwt.verify_password_reset(reset_token)?;
        let invalid_token = || AppError::BadRequest("Invalid or expired reset token.".into());

        if claims.purpose != "password_reset" {
            return Err(invalid_token());
        }

        let email = claims.email.to_lowercase();

        let user = sqlx::query!(
            r#"SELECT id, password_hash FROM users WHERE email = $1"#,
            email
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(invalid_token)?;

        if password_fingerprint(user.password_hash.as_deref()) != claims.password_fingerprint {
            return Err(invalid_token());
        }

        let hash = hash_password(password.to_string()).await?;

        // Compared with the password the token was issued for, so of two
        // concurrent resets with one token only the first succeeds. A reset
        // proves the mailbox, so it also lifts a lock that guesses at the old
        // password started.
        let mut tx = self.db.begin().await?;

        let updated = sqlx::query!(
            r#"UPDATE users
               SET password_hash = $1, password_failed_attempts = 0, password_locked_until = NULL
               WHERE id = $2 AND password_hash IS NOT DISTINCT FROM $3"#,
            hash,
            user.id,
            user.password_hash
        )
        .execute(&mut *tx)
        .await?
        .rows_affected();

        if updated == 0 {
            return Err(invalid_token());
        }

        self.tokens
            .revoke_all_for_user(&mut *tx, user.id, PASSWORD_CHANGE, None)
            .await?;

        // The emailed code proved control of the mailbox, which is as much
        // as a reset ever proves about who acted.
        SecurityEvent::new(SecurityEventKind::PasswordReset)
            .user(user.id)
            .actor(user.id)
            .client(client)
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user.id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user.id,
            SecurityNotice::PasswordReset,
        );

        Ok(())
    }

    /// Leaves the account to its passkeys and Google. Every other session
    /// ends, as after any password change.
    pub async fn remove_password(
        &self,
        user_id: Uuid,
        session_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        let methods = SignInMethods::lock(&mut tx, user_id).await?;
        if !methods.password {
            return Err(AppError::bad_request("Your account has no password."));
        }
        methods.ensure_one_left_without(SignInMethod::Password)?;

        sqlx::query!(
            r#"UPDATE users
               SET password_hash = NULL, reauth_failed_attempts = 0, reauth_locked_until = NULL,
                   password_failed_attempts = 0, password_locked_until = NULL
               WHERE id = $1"#,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        SecurityEvent::new(SecurityEventKind::PasswordRemoved)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .record(&mut *tx)
            .await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, PASSWORD_CHANGE, Some(session_id))
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user_id,
            SecurityNotice::PasswordRemoved,
        );

        Ok(())
    }

    /// The current password is checked like a confirmation of the signed-in
    /// user, under its per-account limit: the session alone must not allow
    /// guessing it.
    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: String,
        new_password: String,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        validate_password_strength(&new_password).map_err(|e| AppError::BadRequest(e.into()))?;

        let user = sqlx::query!(
            r#"SELECT email, password_hash IS NOT NULL AS "has_password!" FROM users WHERE id = $1"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(AppError::TokenExpired)?;

        if !user.has_password {
            return Err(AppError::bad_request("Your account has no password yet."));
        }

        confirm_password(&self.db, user_id, current_password, client).await?;

        let hash = hash_password(new_password).await?;

        let mut tx = self.db.begin().await?;

        sqlx::query!(
            r#"UPDATE users
               SET password_hash = $1, password_failed_attempts = 0, password_locked_until = NULL
               WHERE id = $2"#,
            hash,
            user_id
        )
        .execute(&mut *tx)
        .await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, PASSWORD_CHANGE, None)
            .await?;

        let jar = self
            .issue_session(&mut tx, user_id, &user.email, client)
            .await?;

        SecurityEvent::new(SecurityEventKind::PasswordChanged)
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
            SecurityNotice::PasswordChanged,
        );

        Ok(jar)
    }

    /// Ends the session the refresh token belongs to, if it is still live.
    pub async fn sign_out(&self, refresh_token: &str, client: &ClientInfo) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        if let Some(user_id) = self
            .tokens
            .revoke_current_family(&mut *tx, refresh_token, LOGOUT)
            .await?
        {
            record_sign_out(&mut tx, user_id, json!({ "scope": "current" }), client).await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Ends every session of the user, or every one but `keep`.
    pub async fn sign_out_everywhere(
        &self,
        user_id: Uuid,
        keep: Option<Uuid>,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        self.tokens
            .revoke_all_for_user(&mut *tx, user_id, LOGOUT_ALL, keep)
            .await?;

        let scope = if keep.is_some() { "others" } else { "all" };
        record_sign_out(&mut tx, user_id, json!({ "scope": scope }), client).await?;

        tx.commit().await?;
        Ok(())
    }

    /// Ends one session from the user's session list. `false` when no live
    /// session of theirs has that id.
    pub async fn end_session(
        &self,
        user_id: Uuid,
        session_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<bool> {
        let mut tx = self.db.begin().await?;

        let ended = self
            .tokens
            .revoke_own_session(&mut *tx, user_id, session_id, SESSION_REVOKED)
            .await?;

        if ended {
            record_sign_out(
                &mut tx,
                user_id,
                json!({ "scope": "one", "sessionId": session_id }),
                client,
            )
            .await?;
        }

        tx.commit().await?;
        Ok(ended)
    }
}

/// Logs a sign-out and tells the user's devices, after the sessions it ended
/// were revoked on the same connection.
async fn record_sign_out(
    conn: &mut PgConnection,
    user_id: Uuid,
    metadata: serde_json::Value,
    client: &ClientInfo,
) -> AppResult<()> {
    SecurityEvent::new(SecurityEventKind::SignOut)
        .user(user_id)
        .actor(user_id)
        .client(client)
        .metadata(metadata)
        .record(&mut *conn)
        .await?;

    publish(&mut *conn, [security_changed(user_id)]).await?;

    Ok(())
}

pub enum LoginResult {
    Success(CookieJar),
    MfaRequired(CookieJar),
}

impl LoginResult {
    /// The cookies to set and what the client learns about the sign-in.
    pub fn into_parts(self) -> (CookieJar, SignInResultDto) {
        match self {
            Self::Success(jar) => (
                jar,
                SignInResultDto {
                    requires_mfa: false,
                },
            ),
            Self::MfaRequired(jar) => (jar, SignInResultDto { requires_mfa: true }),
        }
    }
}

/// Sign-in methods, second factors and sessions show on every device, and an
/// ended session's event stream closes with the next one.
pub const fn security_changed(user_id: Uuid) -> Notice {
    Notice::account(user_id, AccountTopic::Security)
}

/// Identifies the password a reset token replaces without exposing it: once
/// the password changes, the fingerprint and with it the token stop matching.
fn password_fingerprint(password_hash: Option<&str>) -> String {
    hex::encode(
        Sha256::new()
            .chain_update(b"password-reset\0")
            .chain_update(password_hash.unwrap_or_default())
            .finalize(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_fingerprint_changes_with_the_password() {
        let first = password_fingerprint(Some("$argon2id$first"));

        assert_eq!(first, password_fingerprint(Some("$argon2id$first")));
        assert_ne!(first, password_fingerprint(Some("$argon2id$second")));
        assert_ne!(first, password_fingerprint(None));
    }
}
