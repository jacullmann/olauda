use crate::items::dto::ItemDto;
use axum::{
    Json,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;
use uuid::Uuid;

const UNEXPECTED: &str = "An unexpected error occurred.";

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),

    #[error("Validation error")]
    Validation(Vec<String>),

    #[error("{0}")]
    Unauthorized(String),

    #[error("Authentication required.")]
    AuthRequired,

    #[error("Access token is invalid or has expired.")]
    TokenExpired,

    /// The second-factor challenge is missing, expired or invalid. Every case
    /// means the same to the client: the sign-in has to start over.
    #[error("Two-factor sign-in has expired. Please sign in again.")]
    MfaChallengeExpired,

    /// Too many wrong passwords at sign-in in a row; the password accepts none
    /// until the lock ends, while passkeys, Google and a reset still work.
    #[error("Too many incorrect passwords. Please try again later.")]
    LoginLocked { retry_after: chrono::TimeDelta },

    /// Too many wrong second-factor codes in a row; the factor accepts none
    /// until the lock ends.
    #[error("Too many incorrect codes. Please try again later.")]
    MfaLocked { retry_after: chrono::TimeDelta },

    /// The address received as many emailed codes as it may for now.
    #[error("Too many codes requested. Please try again later.")]
    EmailCodeThrottled { retry_after: chrono::TimeDelta },

    #[error("{0}")]
    Passkey(PasskeyFailure),

    #[error("{0}")]
    Auth(AuthFailure),

    /// The action needs a recent sign-in; the client confirms who the user is
    /// and repeats the request.
    #[error("Please confirm it's you to continue.")]
    ReauthRequired,

    /// Too many wrong passwords while confirming an action.
    #[error("Too many incorrect attempts. Please try again later.")]
    ReauthLocked { retry_after: chrono::TimeDelta },

    /// A superadmin paused sign-ups.
    #[error("Sign-ups are paused.")]
    RegistrationPaused,

    /// A superadmin shut the platform down, which admits nobody
    /// but superadmins.
    #[error("The platform is shut down.")]
    Shutdown,

    /// The user tried to join a group that banned them.
    #[error("You have been banned from this group.")]
    BannedFromGroup,

    /// A superadmin banned the whole group, so its members cannot open it.
    #[error("This group has been banned.")]
    GroupBanned { group_id: Uuid },

    /// A moderator muted the caller, who can still read the group but not
    /// change anything in it.
    #[error("You are muted in this group.")]
    MutedInGroup { group_id: Uuid },

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    NotFound(String),

    #[error("The file is larger than {max_bytes} bytes.")]
    FileTooLarge { max_bytes: u64 },

    #[error("Only images, PDFs and Word, PowerPoint or Excel documents can be uploaded.")]
    UnsupportedFile,

    #[error("A task like this one already exists.")]
    DuplicateItem(Box<ItemDto>),

    #[error("{0}")]
    NameTaken(String),

    /// A service this server relies on failed; `code` tells the client which
    /// failure it was, so it can say what needs fixing.
    #[error("{message}")]
    Upstream {
        code: ErrorCode,
        message: &'static str,
    },

    #[error("{UNEXPECTED}")]
    Internal(#[from] anyhow::Error),

    #[error("Database error.")]
    Database(#[from] sqlx::Error),
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(anyhow::anyhow!(msg.into()))
    }

    /// Turns a unique violation into [`AppError::NameTaken`] so a racing
    /// duplicate gets the same answer as one caught upfront.
    pub fn name_taken_on_conflict(err: sqlx::Error, msg: &str) -> Self {
        match err.as_database_error() {
            Some(db) if db.is_unique_violation() => Self::NameTaken(msg.to_owned()),
            _ => Self::Database(err),
        }
    }
}

/// The body of every error response. `error` is English and meant for
/// debugging; clients explain a failure by its `code`.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ErrorBody {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<ErrorCode>,
    /// Seconds until a refused action may be tried again.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<i64>,
    /// The group a ban or mute applies to, so a client with several groups
    /// open knows which one is affected.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_bytes: Option<u64>,
    /// The fields that failed validation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<String>>,
    /// The task a new one would duplicate.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate: Option<Box<ItemDto>>,
}

impl ErrorBody {
    pub fn new(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            code: None,
            retry_after: None,
            group_id: None,
            max_bytes: None,
            fields: None,
            duplicate: None,
        }
    }

    pub fn with_code(error: impl Into<String>, code: ErrorCode) -> Self {
        Self {
            code: Some(code),
            ..Self::new(error)
        }
    }
}

/// Every reason a client may tell apart and act on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// The access token is missing or expired; a refresh can fix it.
    AuthRequired,
    MfaChallengeExpired,
    LoginLocked,
    MfaLocked,
    EmailCodeThrottled,
    PasskeyChallengeExpired,
    PasskeyUnknown,
    PasskeyRejected,
    PasskeyRegistrationRejected,
    PasskeyAlreadyRegistered,
    PasskeyLimitReached,
    InvalidCredentials,
    IncorrectPassword,
    EmailAlreadyRegistered,
    EmailNotVerified,
    SecondFactorRequired,
    InvalidSecondFactor,
    LastSignInMethod,
    ReauthRequired,
    ReauthLocked,
    RegistrationPaused,
    Shutdown,
    BannedFromGroup,
    GroupBanned,
    MutedInGroup,
    FileTooLarge,
    UnsupportedFile,
    DuplicateItem,
    NameTaken,
    RateLimited,
    ResendNotConfigured,
    ResendKeyRejected,
    ResendUnreachable,
    HetznerTokenRejected,
    HetznerServerNotFound,
    HetznerUnreachable,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let message = self.to_string();
        let coded = |status, code| (status, ErrorBody::with_code(message.clone(), code));

        let (status, body) = match self {
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, ErrorBody::new(message)),
            AppError::Validation(fields) => (
                StatusCode::BAD_REQUEST,
                ErrorBody {
                    fields: Some(fields),
                    ..ErrorBody::new(message)
                },
            ),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, ErrorBody::new(message)),
            AppError::AuthRequired | AppError::TokenExpired => {
                coded(StatusCode::UNAUTHORIZED, ErrorCode::AuthRequired)
            }
            AppError::MfaChallengeExpired => {
                coded(StatusCode::UNAUTHORIZED, ErrorCode::MfaChallengeExpired)
            }
            AppError::LoginLocked { retry_after } => {
                return too_many_requests(
                    message,
                    ErrorCode::LoginLocked,
                    whole_seconds(retry_after),
                );
            }
            AppError::MfaLocked { retry_after } => {
                return too_many_requests(
                    message,
                    ErrorCode::MfaLocked,
                    whole_seconds(retry_after),
                );
            }
            AppError::EmailCodeThrottled { retry_after } => {
                return too_many_requests(
                    message,
                    ErrorCode::EmailCodeThrottled,
                    whole_seconds(retry_after),
                );
            }
            AppError::Passkey(failure) => coded(failure.status(), failure.code()),
            AppError::Auth(failure) => coded(failure.status(), failure.code()),
            // A 403, not a 401: the session is valid, and a 401 would send the
            // client to refresh it instead of asking the user to confirm.
            AppError::ReauthRequired => coded(StatusCode::FORBIDDEN, ErrorCode::ReauthRequired),
            AppError::ReauthLocked { retry_after } => {
                return too_many_requests(
                    message,
                    ErrorCode::ReauthLocked,
                    whole_seconds(retry_after),
                );
            }
            AppError::RegistrationPaused => {
                coded(StatusCode::FORBIDDEN, ErrorCode::RegistrationPaused)
            }
            // A 503, not a 401: the session stays valid through shutdown,
            // and a 401 would send the client to refresh it and then sign out.
            AppError::Shutdown => coded(StatusCode::SERVICE_UNAVAILABLE, ErrorCode::Shutdown),
            AppError::BannedFromGroup => coded(StatusCode::FORBIDDEN, ErrorCode::BannedFromGroup),
            AppError::GroupBanned { group_id } => (
                StatusCode::FORBIDDEN,
                ErrorBody {
                    group_id: Some(group_id),
                    ..ErrorBody::with_code(message, ErrorCode::GroupBanned)
                },
            ),
            AppError::MutedInGroup { group_id } => (
                StatusCode::FORBIDDEN,
                ErrorBody {
                    group_id: Some(group_id),
                    ..ErrorBody::with_code(message, ErrorCode::MutedInGroup)
                },
            ),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, ErrorBody::new(message)),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, ErrorBody::new(message)),
            AppError::FileTooLarge { max_bytes } => (
                StatusCode::PAYLOAD_TOO_LARGE,
                ErrorBody {
                    max_bytes: Some(max_bytes),
                    ..ErrorBody::with_code(message, ErrorCode::FileTooLarge)
                },
            ),
            AppError::UnsupportedFile => coded(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                ErrorCode::UnsupportedFile,
            ),
            AppError::DuplicateItem(item) => (
                StatusCode::CONFLICT,
                ErrorBody {
                    duplicate: Some(item),
                    ..ErrorBody::with_code(message, ErrorCode::DuplicateItem)
                },
            ),
            AppError::NameTaken(_) => coded(StatusCode::CONFLICT, ErrorCode::NameTaken),
            AppError::Upstream { code, .. } => coded(StatusCode::BAD_GATEWAY, code),
            AppError::Internal(e) => {
                tracing::error!("Internal error: {e:#}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorBody::new(UNEXPECTED),
                )
            }
            AppError::Database(e) => {
                tracing::error!("Database error: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ErrorBody::new(UNEXPECTED),
                )
            }
        };

        (status, Json(body)).into_response()
    }
}

/// A 429 that tells the client how many seconds to wait before trying again.
pub fn too_many_requests(message: String, code: ErrorCode, secs: i64) -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, secs.to_string())],
        Json(ErrorBody {
            retry_after: Some(secs),
            ..ErrorBody::with_code(message, code)
        }),
    )
        .into_response()
}

/// Rounded up, so a client that waits exactly this long is never refused again.
fn whole_seconds(delta: chrono::TimeDelta) -> i64 {
    (delta.num_milliseconds().max(0) + 999) / 1000
}

/// Why a passkey registration or sign-in was refused. Each case has its own
/// code, so the client can explain it in the user's language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum PasskeyFailure {
    /// The ceremony is unknown, already answered or past its deadline; the
    /// client has to start a new one.
    #[error("The passkey request has expired. Please try again.")]
    ChallengeExpired,

    /// No account holds the credential, e.g. because its passkey was removed
    /// from the account but not from the device.
    #[error("This passkey is not registered.")]
    UnknownCredential,

    #[error("The passkey could not be verified.")]
    SignInRejected,

    #[error("The passkey could not be registered.")]
    RegistrationRejected,

    #[error("This passkey is already registered.")]
    AlreadyRegistered,

    #[error("You have reached the maximum number of passkeys.")]
    LimitReached,
}

impl PasskeyFailure {
    // Failed registrations come from a signed-in user, who must not be sent
    // to refresh their session, so only sign-in failures are a 401.
    fn status(self) -> StatusCode {
        match self {
            Self::UnknownCredential | Self::SignInRejected => StatusCode::UNAUTHORIZED,
            Self::AlreadyRegistered => StatusCode::CONFLICT,
            Self::ChallengeExpired | Self::RegistrationRejected | Self::LimitReached => {
                StatusCode::BAD_REQUEST
            }
        }
    }

    fn code(self) -> ErrorCode {
        match self {
            Self::ChallengeExpired => ErrorCode::PasskeyChallengeExpired,
            Self::UnknownCredential => ErrorCode::PasskeyUnknown,
            Self::SignInRejected => ErrorCode::PasskeyRejected,
            Self::RegistrationRejected => ErrorCode::PasskeyRegistrationRejected,
            Self::AlreadyRegistered => ErrorCode::PasskeyAlreadyRegistered,
            Self::LimitReached => ErrorCode::PasskeyLimitReached,
        }
    }
}

impl From<PasskeyFailure> for AppError {
    fn from(failure: PasskeyFailure) -> Self {
        Self::Passkey(failure)
    }
}

/// Why signing in, or confirming an action, was refused. Each case has its own
/// code, so the client can explain it in the user's language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum AuthFailure {
    #[error("Invalid credentials.")]
    InvalidCredentials,

    /// A signed-in user confirming an action entered the wrong password.
    #[error("The password is incorrect.")]
    IncorrectPassword,

    /// A confirmed account already uses the address.
    #[error("Email address is already registered.")]
    EmailAlreadyRegistered,

    /// The account exists but its email address was never confirmed.
    #[error("Please verify your email address first.")]
    EmailNotVerified,

    /// The account has two-factor authentication on, and no code was sent.
    #[error("A two-factor code is required.")]
    SecondFactorRequired,

    #[error("The code is incorrect.")]
    InvalidSecondFactor,

    /// The change would leave the account without any way to sign in.
    #[error("Your account needs at least one other way to sign in.")]
    LastSignInMethod,
}

impl AuthFailure {
    // Failures while confirming an action come from a signed-in user, who must
    // not be sent to refresh their session, so only sign-in failures are a 401.
    fn status(self) -> StatusCode {
        match self {
            Self::InvalidCredentials | Self::EmailNotVerified => StatusCode::UNAUTHORIZED,
            Self::IncorrectPassword | Self::SecondFactorRequired | Self::InvalidSecondFactor => {
                StatusCode::BAD_REQUEST
            }
            Self::EmailAlreadyRegistered | Self::LastSignInMethod => StatusCode::CONFLICT,
        }
    }

    fn code(self) -> ErrorCode {
        match self {
            Self::InvalidCredentials => ErrorCode::InvalidCredentials,
            Self::IncorrectPassword => ErrorCode::IncorrectPassword,
            Self::EmailAlreadyRegistered => ErrorCode::EmailAlreadyRegistered,
            Self::EmailNotVerified => ErrorCode::EmailNotVerified,
            Self::SecondFactorRequired => ErrorCode::SecondFactorRequired,
            Self::InvalidSecondFactor => ErrorCode::InvalidSecondFactor,
            Self::LastSignInMethod => ErrorCode::LastSignInMethod,
        }
    }
}

impl From<AuthFailure> for AppError {
    fn from(failure: AuthFailure) -> Self {
        Self::Auth(failure)
    }
}

pub type AppResult<T> = Result<T, AppError>;
