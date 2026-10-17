use crate::{
    auth::{email_code::EmailCode, token::SessionInfo},
    common::{locale::Locale, role::Role, theme::Theme},
    user::dto::{CourseSelectionDto, PreferencesDto},
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginDto {
    #[validate(email(message = "Invalid credentials."))]
    pub email: String,

    #[validate(length(min = 1, max = 255, message = "Invalid credentials."))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterDto {
    #[validate(email(message = "Invalid email address."))]
    pub email: String,

    #[validate(length(max = 255))]
    pub password: String,

    #[validate(custom(function = "must_be_accepted"))]
    pub accepted_terms: bool,

    #[serde(default)]
    pub preferences: RegisterPreferencesDto,
}

#[derive(Debug, Default, Deserialize, Serialize, ToSchema)]
pub struct RegisterPreferencesDto {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub language: Locale,
}

/// Every sign-up path has to send the acceptance of the terms explicitly, so
/// no client can create an account without having asked for it.
pub(crate) fn must_be_accepted(accepted: &bool) -> Result<(), validator::ValidationError> {
    if *accepted {
        Ok(())
    } else {
        Err(validator::ValidationError::new("terms_not_accepted"))
    }
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForgotPasswordDto {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResendVerificationDto {
    #[validate(email)]
    pub email: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmSignUpDto {
    #[validate(email)]
    pub email: String,

    pub code: EmailCode,

    #[validate(length(min = 1, max = 255))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordVerifyDto {
    #[validate(email)]
    pub email: String,

    pub code: EmailCode,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordDto {
    #[validate(length(max = 2048))]
    pub reset_token: String,

    #[validate(length(max = 255))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordDto {
    #[validate(length(min = 1, max = 255))]
    pub current_password: String,

    #[validate(length(max = 255))]
    pub new_password: String,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetPasswordDto {
    pub code: EmailCode,

    #[validate(length(max = 255))]
    pub new_password: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignInResultDto {
    /// The password was right; the second factor is asked next.
    pub requires_mfa: bool,
}

/// What the second-factor step of a sign-in may offer.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MfaChallengeDto {
    /// Seconds left to finish the sign-in.
    pub expires_in: i64,
    pub passkey_available: bool,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MfaSignInDto {
    /// Set when a recovery code was used, so the client can warn early.
    pub recovery_codes_left: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ResetTokenDto {
    /// Sent along with the new password.
    pub reset_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUserDto {
    pub id: Uuid,
    pub email: String,
    /// `superadmin` or `user`; group roles come with each group.
    pub role: Role,
    /// The courses the user takes, in every group.
    pub courses: Vec<CourseSelectionDto>,
    pub personalized: bool,
    pub mfa_enabled: bool,
    /// Google-only accounts have no password until they set one.
    pub has_password: bool,
    pub preferences: PreferencesDto,
    /// The user's pseudonym, the same in every group.
    pub username: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SessionListDto {
    pub sessions: Vec<SessionInfo>,
    /// The session the request was made in.
    pub current_family_id: Uuid,
}
