use crate::auth::dto::must_be_accepted;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use validator::Validate;

#[derive(Debug, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GoogleSignUpDto {
    #[validate(custom(function = "must_be_accepted"))]
    pub accepted_terms: bool,
}

/// Where the browser goes to continue with Google.
#[derive(Debug, Serialize, ToSchema)]
pub struct GoogleAuthUrlDto {
    pub url: String,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct OAuthCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkedProviderDto {
    pub provider: String,
    /// The address the provider account belongs to.
    pub email: String,
}
