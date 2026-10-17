use super::dto::{PasskeyList, PasskeySummary};
use crate::{
    auth::{
        security_notice,
        service::{AuthService, LoginResult, SecondFactorKind, security_changed},
        sign_in_methods::{SignInMethod, SignInMethods},
    },
    common::{
        client::ClientInfo,
        email::{EmailService, SecurityNotice},
        names::DisplayName,
    },
    config::{PASSKEY_CEREMONY_TTL, chrono_ttl},
    error::{AppError, AppResult, PasskeyFailure},
    realtime::event::publish,
    security_log::{SecurityEvent, SecurityEventKind},
    state::AppState,
};
use axum_extra::extract::CookieJar;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;
use webauthn_rs::{
    Webauthn,
    prelude::{
        CreationChallengeResponse, CredentialID, DiscoverableAuthentication, DiscoverableKey,
        Passkey, PasskeyAuthentication, PasskeyRegistration, PublicKeyCredential,
        RegisterPublicKeyCredential,
    },
};
use webauthn_rs_proto::{
    PublicKeyCredentialCreationOptions, PublicKeyCredentialRequestOptions, ResidentKeyRequirement,
};

/// Each passkey is listed in the settings and offered by the browser, so the
/// cap only has to stop a single account from growing without bound.
pub const MAX_PASSKEYS_PER_USER: usize = 20;
pub const PASSKEY_NAME_MAX_CHARS: usize = 64;

const PASSKEY_ALREADY_REGISTERED_CONSTRAINT: &str = "passkeys_credential_id_key";

/// What a user calls one of their passkeys, e.g. the device it lives on.
pub struct PasskeyName(DisplayName);

impl PasskeyName {
    pub fn parse(raw: &str) -> AppResult<Self> {
        DisplayName::parse(raw, PASSKEY_NAME_MAX_CHARS, "name").map(Self)
    }

    fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

pub struct PasskeyService {
    db: PgPool,
    webauthn: Arc<Webauthn>,
    email: EmailService,
    auth: AuthService,
    rp_id: String,
}

impl PasskeyService {
    pub fn from_state(state: &AppState) -> Self {
        Self {
            db: state.db.clone(),
            webauthn: state.webauthn.clone(),
            email: state.email.clone(),
            auth: AuthService::from_state(state),
            rp_id: state.config.webauthn.rp_id.clone(),
        }
    }

    pub async fn list(&self, user_id: Uuid) -> AppResult<PasskeyList> {
        let passkeys = sqlx::query!(
            r#"SELECT id, name, created_at, last_used_at, credential_id
               FROM passkeys
               WHERE user_id = $1
               ORDER BY created_at"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?
        .into_iter()
        .map(|row| PasskeySummary {
            id: row.id,
            name: row.name,
            created_at: row.created_at,
            last_used_at: row.last_used_at,
            credential_id: URL_SAFE_NO_PAD.encode(row.credential_id),
        })
        .collect();

        Ok(PasskeyList {
            passkeys,
            rp_id: self.rp_id.clone(),
            user_handle: URL_SAFE_NO_PAD.encode(user_id.as_bytes()),
        })
    }

    pub async fn start_registration(
        &self,
        user_id: Uuid,
    ) -> AppResult<PublicKeyCredentialCreationOptions> {
        let user = sqlx::query!(
            r#"SELECT u.email,
                      COALESCE(array_agg(p.credential_id) FILTER (WHERE p.id IS NOT NULL), '{}')
                          AS "credential_ids!"
               FROM users u
               LEFT JOIN passkeys p ON p.user_id = u.id
               WHERE u.id = $1
               GROUP BY u.id"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        if user.credential_ids.len() >= MAX_PASSKEYS_PER_USER {
            return Err(PasskeyFailure::LimitReached.into());
        }

        // Listing the user's passkeys lets the authenticator refuse to create
        // a second one for the same account.
        let exclude = user
            .credential_ids
            .into_iter()
            .map(CredentialID::from)
            .collect();

        let (mut challenge, registration) = self
            .webauthn
            .start_passkey_registration(user_id, &user.email, &user.email, Some(exclude))
            .map_err(|e| {
                AppError::internal(format!("Passkey registration failed to start: {e}"))
            })?;

        require_discoverable(&mut challenge);

        sqlx::query!(
            r#"INSERT INTO passkey_registrations (user_id, state, expires_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id) DO UPDATE SET state = $2, expires_at = $3"#,
            user_id,
            to_state(&registration)?,
            ceremony_deadline(),
        )
        .execute(&self.db)
        .await?;

        Ok(challenge.public_key)
    }

    pub async fn finish_registration(
        &self,
        user_id: Uuid,
        name: PasskeyName,
        credential: &RegisterPublicKeyCredential,
        client: &ClientInfo,
    ) -> AppResult<PasskeySummary> {
        // Deleted before it is checked, so every registration is answered at
        // most once, whether or not the answer holds up.
        let pending = sqlx::query!(
            r#"DELETE FROM passkey_registrations WHERE user_id = $1 RETURNING state, expires_at"#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        let registration: PasskeyRegistration =
            unexpired_state(pending.map(|p| (p.state, p.expires_at)))?;

        let passkey = self
            .webauthn
            .finish_passkey_registration(credential, &registration)
            .map_err(|e| {
                tracing::info!(%user_id, "Passkey registration rejected: {e}");
                PasskeyFailure::RegistrationRejected
            })?;

        let mut tx = self.db.begin().await?;

        // Locking the user serialises concurrent registrations, so none of
        // them can slip past the limit.
        let user = sqlx::query!(
            r#"SELECT (SELECT count(*) FROM passkeys p WHERE p.user_id = u.id) AS "passkey_count!"
               FROM users u
               WHERE u.id = $1
               FOR UPDATE"#,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        if usize::try_from(user.passkey_count).unwrap_or(usize::MAX) >= MAX_PASSKEYS_PER_USER {
            return Err(PasskeyFailure::LimitReached.into());
        }

        let credential_id: &[u8] = passkey.cred_id().as_ref();

        let created = sqlx::query!(
            r#"INSERT INTO passkeys (user_id, credential_id, credential, name)
               VALUES ($1, $2, $3, $4)
               RETURNING id, created_at"#,
            user_id,
            credential_id,
            to_state(&passkey)?,
            name.as_str(),
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(already_registered_on_conflict)?;

        SecurityEvent::new(SecurityEventKind::PasskeyAdded)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(json!({ "passkeyId": created.id, "name": name.as_str() }))
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(&self.db, &self.email, user_id, SecurityNotice::PasskeyAdded);

        Ok(PasskeySummary {
            id: created.id,
            name: name.as_str().to_owned(),
            created_at: created.created_at,
            last_used_at: None,
            credential_id: URL_SAFE_NO_PAD.encode(credential_id),
        })
    }

    pub async fn rename(
        &self,
        user_id: Uuid,
        passkey_id: Uuid,
        name: PasskeyName,
    ) -> AppResult<()> {
        sqlx::query!(
            r#"UPDATE passkeys SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING id"#,
            passkey_id,
            user_id,
            name.as_str()
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(passkey_not_found)?;

        publish(&self.db, [security_changed(user_id)]).await?;

        Ok(())
    }

    pub async fn remove(
        &self,
        user_id: Uuid,
        passkey_id: Uuid,
        client: &ClientInfo,
    ) -> AppResult<()> {
        let mut tx = self.db.begin().await?;

        SignInMethods::lock(&mut tx, user_id)
            .await?
            .ensure_one_left_without(SignInMethod::Passkey)?;

        let removed = sqlx::query!(
            r#"DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING name"#,
            passkey_id,
            user_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(passkey_not_found)?;

        SecurityEvent::new(SecurityEventKind::PasskeyRemoved)
            .user(user_id)
            .actor(user_id)
            .client(client)
            .metadata(json!({ "passkeyId": passkey_id, "name": removed.name }))
            .record(&mut *tx)
            .await?;

        publish(&mut *tx, [security_changed(user_id)]).await?;
        tx.commit().await?;

        security_notice::notify(
            &self.db,
            &self.email,
            user_id,
            SecurityNotice::PasskeyRemoved,
        );

        Ok(())
    }

    /// Starts a check with one of the user's own passkeys, for confirming a
    /// sensitive action or as the second step of a sign-in. The challenge is
    /// bound to the user, so it can never serve a usernameless sign-in.
    pub async fn start_bound_authentication(
        &self,
        user_id: Uuid,
    ) -> AppResult<(Uuid, PublicKeyCredentialRequestOptions)> {
        let passkeys = sqlx::query_scalar!(
            r#"SELECT credential FROM passkeys WHERE user_id = $1"#,
            user_id
        )
        .fetch_all(&self.db)
        .await?
        .into_iter()
        .map(from_state::<Passkey>)
        .collect::<AppResult<Vec<_>>>()?;

        if passkeys.is_empty() {
            return Err(PasskeyFailure::UnknownCredential.into());
        }

        // Passkey authentication always requires user verification, so the
        // check proves possession and the device's PIN or biometrics.
        let (challenge, authentication) = self
            .webauthn
            .start_passkey_authentication(&passkeys)
            .map_err(|e| {
                AppError::internal(format!("Passkey authentication failed to start: {e}"))
            })?;

        let challenge_id = sqlx::query_scalar!(
            r#"WITH purged AS (DELETE FROM passkey_challenges WHERE expires_at < now())
               INSERT INTO passkey_challenges (state, expires_at, user_id)
               VALUES ($1, $2, $3)
               RETURNING id"#,
            to_state(&authentication)?,
            ceremony_deadline(),
            user_id,
        )
        .fetch_one(&self.db)
        .await?;

        Ok((challenge_id, challenge.public_key))
    }

    /// Verifies the answer to [`Self::start_bound_authentication`] and stores
    /// the passkey's new signature counter.
    pub async fn finish_bound_authentication(
        &self,
        user_id: Uuid,
        challenge_id: Uuid,
        credential: &PublicKeyCredential,
    ) -> AppResult<()> {
        let pending = sqlx::query!(
            r#"DELETE FROM passkey_challenges WHERE id = $1 AND user_id = $2
               RETURNING state, expires_at"#,
            challenge_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        let authentication: PasskeyAuthentication =
            unexpired_state(pending.map(|p| (p.state, p.expires_at)))?;

        let result = self
            .webauthn
            .finish_passkey_authentication(credential, &authentication)
            .map_err(|e| {
                tracing::warn!(%user_id, "Bound passkey authentication rejected: {e}");
                PasskeyFailure::SignInRejected
            })?;

        let mut tx = self.db.begin().await?;

        let credential_id: &[u8] = result.cred_id().as_ref();
        let stored = sqlx::query!(
            r#"SELECT id, credential FROM passkeys
               WHERE user_id = $1 AND credential_id = $2
               FOR UPDATE"#,
            user_id,
            credential_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(PasskeyFailure::UnknownCredential)?;

        let mut passkey: Passkey = from_state(stored.credential)?;
        let updated_credential = match passkey.update_credential(&result) {
            Some(true) => Some(to_state(&passkey)?),
            _ => None,
        };

        sqlx::query!(
            r#"UPDATE passkeys
               SET credential = COALESCE($2, credential), last_used_at = now()
               WHERE id = $1"#,
            stored.id,
            updated_credential
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(())
    }

    /// Answers a sign-in held for its second factor with one of the user's
    /// passkeys. The password already named the account, so the passkey only
    /// has to prove it is the owner's, which it does more strongly than a
    /// code: it cannot be phished and verifies the user on the device.
    pub async fn finish_second_factor(
        &self,
        user_id: Uuid,
        email: &str,
        challenge_id: Uuid,
        credential: &PublicKeyCredential,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        self.finish_bound_authentication(user_id, challenge_id, credential)
            .await?;

        self.auth
            .finish_two_factor_sign_in(user_id, email, SecondFactorKind::Passkey, client)
            .await
    }

    /// Starts a usernameless sign-in: the browser offers every passkey it
    /// holds for this site, and the chosen one names the account.
    pub async fn start_sign_in(&self) -> AppResult<(Uuid, PublicKeyCredentialRequestOptions)> {
        let (challenge, authentication) = self
            .webauthn
            .start_discoverable_authentication()
            .map_err(|e| AppError::internal(format!("Passkey sign-in failed to start: {e}")))?;

        // Anyone may ask for a challenge, so issuing one also clears out the
        // expired ones rather than leaving them to pile up.
        let challenge_id = sqlx::query_scalar!(
            r#"WITH purged AS (DELETE FROM passkey_challenges WHERE expires_at < now())
               INSERT INTO passkey_challenges (state, expires_at)
               VALUES ($1, $2)
               RETURNING id"#,
            to_state(&authentication)?,
            ceremony_deadline(),
        )
        .fetch_one(&self.db)
        .await?;

        Ok((challenge_id, challenge.public_key))
    }

    /// A passkey always verifies the user (biometrics or device PIN), so it
    /// replaces both password and second factor: no TOTP code is asked for.
    pub async fn finish_sign_in(
        &self,
        challenge_id: Uuid,
        credential: &PublicKeyCredential,
        client: &ClientInfo,
    ) -> AppResult<CookieJar> {
        let pending = sqlx::query!(
            r#"DELETE FROM passkey_challenges WHERE id = $1 AND user_id IS NULL
               RETURNING state, expires_at"#,
            challenge_id
        )
        .fetch_optional(&self.db)
        .await?;

        let authentication: DiscoverableAuthentication =
            unexpired_state(pending.map(|p| (p.state, p.expires_at)))?;

        let (user_id, credential_id) = self
            .webauthn
            .identify_discoverable_authentication(credential)
            .map_err(|_| PasskeyFailure::UnknownCredential)?;

        let mut tx = self.db.begin().await?;

        // The row lock makes concurrent sign-ins with one passkey take turns,
        // so each one checks the signature counter the previous one stored.
        let stored = sqlx::query!(
            r#"SELECT p.id, p.credential, u.email
               FROM passkeys p
               JOIN users u ON u.id = p.user_id
               WHERE p.user_id = $1 AND p.credential_id = $2
               FOR UPDATE OF p"#,
            user_id,
            credential_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(PasskeyFailure::UnknownCredential)?;

        let mut passkey: Passkey = from_state(stored.credential)?;

        let result = match self.webauthn.finish_discoverable_authentication(
            credential,
            authentication,
            &[DiscoverableKey::from(&passkey)],
        ) {
            Ok(result) => result,
            Err(e) => {
                tracing::warn!(%user_id, passkey_id = %stored.id, "Passkey sign-in rejected: {e}");
                // A known passkey whose signature does not hold up may be a
                // cloned authenticator.
                SecurityEvent::new(SecurityEventKind::SignInFailed)
                    .user(user_id)
                    .client(client)
                    .metadata(json!({
                        "method": SignInMethod::Passkey.as_str(),
                        "reason": "passkey_rejected",
                        "passkeyId": stored.id,
                    }))
                    .record(&mut *tx)
                    .await?;
                tx.commit().await?;
                return Err(PasskeyFailure::SignInRejected.into());
            }
        };

        let updated_credential = match passkey.update_credential(&result) {
            Some(true) => Some(to_state(&passkey)?),
            _ => None,
        };

        sqlx::query!(
            r#"UPDATE passkeys
               SET credential = COALESCE($2, credential), last_used_at = now()
               WHERE id = $1"#,
            stored.id,
            updated_credential
        )
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        match self
            .auth
            .complete_sign_in(user_id, &stored.email, false, SignInMethod::Passkey, client)
            .await?
        {
            LoginResult::Success(jar) => Ok(jar),
            LoginResult::MfaRequired(_) => Err(AppError::internal(
                "Passkey sign-in asked for a second factor.",
            )),
        }
    }
}

/// webauthn-rs leaves resident keys optional, but sign-in here is
/// usernameless: a passkey the browser cannot discover on its own could never
/// be used.
fn require_discoverable(challenge: &mut CreationChallengeResponse) {
    if let Some(selection) = challenge.public_key.authenticator_selection.as_mut() {
        selection.resident_key = Some(ResidentKeyRequirement::Required);
        selection.require_resident_key = true;
    }
}

fn ceremony_deadline() -> DateTime<Utc> {
    Utc::now() + chrono_ttl(PASSKEY_CEREMONY_TTL)
}

fn to_state<T: Serialize>(value: &T) -> AppResult<Value> {
    serde_json::to_value(value)
        .map_err(|e| AppError::internal(format!("Passkey state not serialisable: {e}")))
}

fn from_state<T: DeserializeOwned>(value: Value) -> AppResult<T> {
    serde_json::from_value(value)
        .map_err(|e| AppError::internal(format!("Stored passkey state unreadable: {e}")))
}

fn unexpired_state<T: DeserializeOwned>(pending: Option<(Value, DateTime<Utc>)>) -> AppResult<T> {
    match pending {
        Some((state, expires_at)) if expires_at > Utc::now() => from_state(state),
        _ => Err(PasskeyFailure::ChallengeExpired.into()),
    }
}

fn already_registered_on_conflict(err: sqlx::Error) -> AppError {
    match err.as_database_error().and_then(|db| db.constraint()) {
        Some(PASSKEY_ALREADY_REGISTERED_CONSTRAINT) => PasskeyFailure::AlreadyRegistered.into(),
        _ => AppError::Database(err),
    }
}

fn passkey_not_found() -> AppError {
    AppError::not_found("Passkey not found.")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::WebauthnConfig;
    use webauthn_rs::prelude::Url;

    fn relying_party() -> Webauthn {
        crate::passkeys::relying_party(&WebauthnConfig {
            rp_id: "olauda.com".into(),
            rp_origin: Url::parse("https://app.olauda.com").unwrap(),
        })
        .unwrap()
    }

    #[test]
    fn registration_demands_a_discoverable_credential() {
        let (mut challenge, _) = relying_party()
            .start_passkey_registration(Uuid::new_v4(), "a@example.com", "a@example.com", None)
            .unwrap();

        require_discoverable(&mut challenge);

        let options = serde_json::to_value(&challenge.public_key).unwrap();
        assert_eq!(options["authenticatorSelection"]["residentKey"], "required");
        assert_eq!(
            options["authenticatorSelection"]["requireResidentKey"],
            true
        );
        assert_eq!(
            options["authenticatorSelection"]["userVerification"],
            "required"
        );
    }

    #[test]
    fn ceremony_state_survives_the_database_round_trip() {
        let (_, registration) = relying_party()
            .start_passkey_registration(Uuid::new_v4(), "a@example.com", "a@example.com", None)
            .unwrap();

        let restored: PasskeyRegistration = from_state(to_state(&registration).unwrap()).unwrap();

        assert_eq!(
            serde_json::to_value(restored).unwrap(),
            serde_json::to_value(registration).unwrap()
        );
    }

    #[test]
    fn expired_or_missing_ceremonies_are_refused() {
        let state = to_state(&json!({})).unwrap();
        let past = Utc::now() - chrono::TimeDelta::seconds(1);

        for pending in [None, Some((state, past))] {
            assert!(matches!(
                unexpired_state::<Value>(pending),
                Err(AppError::Passkey(PasskeyFailure::ChallengeExpired))
            ));
        }
    }

    #[test]
    fn an_origin_outside_the_rp_id_is_refused() {
        let config = WebauthnConfig {
            rp_id: "olauda.com".into(),
            rp_origin: Url::parse("https://evil.example").unwrap(),
        };

        assert!(crate::passkeys::relying_party(&config).is_err());
    }

    #[test]
    fn passkey_names_are_bounded() {
        assert!(PasskeyName::parse("  iPhone  ").is_ok_and(|n| n.as_str() == "iPhone"));
        assert!(PasskeyName::parse("").is_err());
        assert!(PasskeyName::parse(&"x".repeat(PASSKEY_NAME_MAX_CHARS + 1)).is_err());
    }
}
