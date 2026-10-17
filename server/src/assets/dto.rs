use crate::common::cloudinary::ResourceType;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// What clients need to display a stored file and build its delivery URLs.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FileDto {
    pub public_id: String,
    pub resource_type: ResourceType,
    pub format: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub name: Option<String>,
    pub thumbnail_public_id: Option<String>,
}

/// A file uploaded for a task that is not attached yet. Its `id` is what the
/// uploader sends to attach it.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UploadDto {
    pub id: Uuid,
    #[serde(flatten)]
    pub file: FileDto,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupAvatarUploadDto {
    pub id: Uuid,
    pub url: String,
}

/// The multipart form every upload sends: the file in a field named `file`.
#[derive(ToSchema)]
#[expect(dead_code, reason = "describes the form in the API documentation only")]
pub struct UploadForm {
    #[schema(value_type = String, format = Binary)]
    pub file: Vec<u8>,
}
