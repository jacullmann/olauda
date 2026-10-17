use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// The answer to creating something, which the client refers to it by.
#[derive(Debug, Serialize, ToSchema)]
pub struct CreatedDto {
    pub id: Uuid,
}
