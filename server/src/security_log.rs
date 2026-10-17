//! The security audit log (`security_events`): sign-ins, changes to how an
//! account is secured, access to groups and every admin action.
//!
//! It is kept apart from the activity log on purpose. Entries outlive the
//! accounts and groups they name, can be about attempts against no known
//! account, are append-only in the database and are kept longer (see the
//! `security_audit_log` migration). An event is recorded in the transaction
//! of the change it describes wherever there is one, so a change is never
//! committed without its entry.

use crate::common::client::ClientInfo;
use ipnetwork::IpNetwork;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgExecutor;
use uuid::Uuid;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, utoipa::ToSchema,
)]
#[serde(rename_all = "lowercase")]
#[sqlx(type_name = "text", rename_all = "lowercase")]
pub enum Outcome {
    Success,
    Failure,
}

impl Outcome {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Failure => "failure",
        }
    }
}

/// What happened. A kind fixes both the stored `event_type` and whether it
/// counts as a failure, so the two can never contradict each other.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityEventKind {
    SignIn,
    SignInFailed,
    /// A wrong password started a lock of password sign-ins.
    SignInLocked,
    SignOut,
    SecondFactorFailed,
    SecondFactorLocked,
    Reauth,
    ReauthFailed,
    ReauthLocked,
    /// A rotated refresh token came back, so its session was ended as stolen.
    RefreshTokenReused,

    AccountCreated,
    AccountDeleted,
    PasswordChanged,
    PasswordSet,
    PasswordRemoved,
    PasswordResetRequested,
    PasswordReset,
    GoogleLinked,
    GoogleUnlinked,
    DataExported,
    TwoFactorEnabled,
    TwoFactorDisabled,
    RecoveryCodesRegenerated,
    PasskeyAdded,
    PasskeyRemoved,

    GroupCreated,
    GroupDeleted,
    InviteCreated,
    InviteRevoked,
    InviteAccepted,
    MemberRoleChanged,
    MemberRemoved,
    MemberUnbanned,
    MemberMuted,
    MemberUnmuted,
    OwnershipTransferred,
    PermissionsChanged,

    AdminUserBanned,
    AdminUserUnbanned,
    AdminUserDeleted,
    AdminTwoFactorReset,
    AdminGroupBanned,
    AdminGroupUnbanned,
    AdminGroupDeleted,
    AdminAccessControlsChanged,
    AdminAnnouncementCreated,
    AdminAnnouncementUpdated,
    AdminAnnouncementDeleted,
    AdminReportDeleted,
}

impl SecurityEventKind {
    /// The stored `event_type` and outcome, decided together in one place.
    /// A failure shares the type of the success it failed at, so both are
    /// found under one name.
    const fn stored_as(self) -> (&'static str, Outcome) {
        use Outcome::{Failure, Success};

        match self {
            Self::SignIn => ("auth:sign_in", Success),
            Self::SignInFailed => ("auth:sign_in", Failure),
            Self::SignInLocked => ("auth:sign_in_locked", Failure),
            Self::SignOut => ("auth:sign_out", Success),
            Self::SecondFactorFailed => ("auth:second_factor", Failure),
            Self::SecondFactorLocked => ("auth:second_factor_locked", Failure),
            Self::Reauth => ("auth:reauth", Success),
            Self::ReauthFailed => ("auth:reauth", Failure),
            Self::ReauthLocked => ("auth:reauth_locked", Failure),
            Self::RefreshTokenReused => ("auth:refresh_token_reused", Failure),
            Self::AccountCreated => ("account:created", Success),
            Self::AccountDeleted => ("account:deleted", Success),
            Self::PasswordChanged => ("account:password_changed", Success),
            Self::PasswordSet => ("account:password_set", Success),
            Self::PasswordRemoved => ("account:password_removed", Success),
            Self::PasswordResetRequested => ("account:password_reset_requested", Success),
            Self::PasswordReset => ("account:password_reset", Success),
            Self::GoogleLinked => ("account:google_linked", Success),
            Self::GoogleUnlinked => ("account:google_unlinked", Success),
            Self::DataExported => ("account:data_exported", Success),
            Self::TwoFactorEnabled => ("mfa:enabled", Success),
            Self::TwoFactorDisabled => ("mfa:disabled", Success),
            Self::RecoveryCodesRegenerated => ("mfa:recovery_codes_regenerated", Success),
            Self::PasskeyAdded => ("passkey:added", Success),
            Self::PasskeyRemoved => ("passkey:removed", Success),
            Self::GroupCreated => ("group:created", Success),
            Self::GroupDeleted => ("group:deleted", Success),
            Self::InviteCreated => ("group:invite_created", Success),
            Self::InviteRevoked => ("group:invite_revoked", Success),
            Self::InviteAccepted => ("group:invite_accepted", Success),
            Self::MemberRoleChanged => ("group:member_role_changed", Success),
            Self::MemberRemoved => ("group:member_removed", Success),
            Self::MemberUnbanned => ("group:member_unbanned", Success),
            Self::MemberMuted => ("group:member_muted", Success),
            Self::MemberUnmuted => ("group:member_unmuted", Success),
            Self::OwnershipTransferred => ("group:ownership_transferred", Success),
            Self::PermissionsChanged => ("group:permissions_changed", Success),
            Self::AdminUserBanned => ("admin:user_banned", Success),
            Self::AdminUserUnbanned => ("admin:user_unbanned", Success),
            Self::AdminUserDeleted => ("admin:user_deleted", Success),
            Self::AdminTwoFactorReset => ("admin:mfa_reset", Success),
            Self::AdminGroupBanned => ("admin:group_banned", Success),
            Self::AdminGroupUnbanned => ("admin:group_unbanned", Success),
            Self::AdminGroupDeleted => ("admin:group_deleted", Success),
            Self::AdminAccessControlsChanged => ("admin:access_controls_changed", Success),
            Self::AdminAnnouncementCreated => ("admin:announcement_created", Success),
            Self::AdminAnnouncementUpdated => ("admin:announcement_updated", Success),
            Self::AdminAnnouncementDeleted => ("admin:announcement_deleted", Success),
            Self::AdminReportDeleted => ("admin:report_deleted", Success),
        }
    }

    pub const fn event_type(self) -> &'static str {
        self.stored_as().0
    }

    pub const fn outcome(self) -> Outcome {
        self.stored_as().1
    }
}

/// One entry for the security log, built up and then stored with
/// [`Self::record`]:
///
/// ```ignore
/// SecurityEvent::new(SecurityEventKind::PasskeyRemoved)
///     .user(user_id)
///     .actor(user_id)
///     .client(&client)
///     .metadata(json!({ "passkeyId": passkey_id }))
///     .record(&mut *tx)
///     .await?;
/// ```
///
/// Metadata names what was affected, never a secret: no password, code or
/// token goes into it.
#[must_use = "an event is only stored by `record`"]
#[derive(Debug)]
pub struct SecurityEvent<'a> {
    kind: SecurityEventKind,
    user_id: Option<Uuid>,
    actor_id: Option<Uuid>,
    tenant_id: Option<Uuid>,
    client: Option<&'a ClientInfo>,
    metadata: Option<Value>,
}

impl<'a> SecurityEvent<'a> {
    pub const fn new(kind: SecurityEventKind) -> Self {
        Self {
            kind,
            user_id: None,
            actor_id: None,
            tenant_id: None,
            client: None,
            metadata: None,
        }
    }

    /// The account the event is about.
    pub const fn user(mut self, user_id: Uuid) -> Self {
        self.user_id = Some(user_id);
        self
    }

    /// The account that proved who it is and caused the event. Left out for
    /// attempts that proved nothing, such as a wrong password.
    pub const fn actor(mut self, actor_id: Uuid) -> Self {
        self.actor_id = Some(actor_id);
        self
    }

    /// The group the event happened in.
    pub const fn tenant(mut self, tenant_id: Uuid) -> Self {
        self.tenant_id = Some(tenant_id);
        self
    }

    pub const fn client(mut self, client: &'a ClientInfo) -> Self {
        self.client = Some(client);
        self
    }

    pub fn metadata(mut self, metadata: Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub async fn record<'e>(self, executor: impl PgExecutor<'e>) -> sqlx::Result<()> {
        sqlx::query!(
            r#"INSERT INTO security_events
                (event_type, outcome, user_id, actor_id, tenant_id, ip_address, user_agent, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, '{}'::jsonb))"#,
            self.kind.event_type(),
            self.kind.outcome().as_str(),
            self.user_id,
            self.actor_id,
            self.tenant_id,
            self.client.and_then(|c| c.ip).map(IpNetwork::from),
            self.client.and_then(|c| c.user_agent.as_deref()),
            self.metadata,
        )
        .execute(executor)
        .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failures_share_the_type_of_their_success() {
        for (success, failure) in [
            (SecurityEventKind::SignIn, SecurityEventKind::SignInFailed),
            (SecurityEventKind::Reauth, SecurityEventKind::ReauthFailed),
        ] {
            assert_eq!(success.event_type(), failure.event_type());
            assert_eq!(success.outcome(), Outcome::Success);
            assert_eq!(failure.outcome(), Outcome::Failure);
        }
    }
}
