use super::{
    dto::{FileDto, GroupAvatarUploadDto, UploadDto},
    file_kind::{self, FileKind},
};
use crate::{
    common::cloudinary::{AssetFolder, Cloudinary, CloudinaryError, ResourceType},
    error::{AppError, AppResult},
    state::AppState,
};
use axum::{
    extract::{Multipart, multipart::MultipartError},
    http::StatusCode,
};
use sqlx::{PgExecutor, PgPool};
use uuid::Uuid;

/// How long after its upload a file can still be attached. It is half the
/// grace period of `orphaned_assets()`, so the sweep never deletes a file
/// that is being attached at that very moment.
pub const CLAIM_WINDOW_HOURS: i32 = 12;
const MULTIPART_FIELD: &str = "file";
const FILE_NAME_MAX_CHARS: usize = 255;

/// What a stored file is for. Each purpose is claimed by its own owner only,
/// so a group picture can never turn into a task attachment or vice versa.
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "text", rename_all = "snake_case")]
pub enum AssetPurpose {
    Attachment,
    Thumbnail,
    GroupAvatar,
}

impl AssetPurpose {
    pub const fn folder(self) -> AssetFolder {
        match self {
            Self::Attachment | Self::Thumbnail => AssetFolder::Tasks,
            Self::GroupAvatar => AssetFolder::GroupPictures,
        }
    }
}

/// A file as received, before anything about it is trusted.
pub struct ReceivedFile {
    bytes: Vec<u8>,
    name: Option<String>,
}

impl ReceivedFile {
    /// Reads the single `file` field, refusing to buffer more than `max_bytes`.
    pub async fn read(mut multipart: Multipart, max_bytes: usize) -> AppResult<Self> {
        let multipart_error = |err: MultipartError| {
            if err.status() == StatusCode::PAYLOAD_TOO_LARGE {
                file_too_large(max_bytes)
            } else {
                AppError::bad_request("Malformed upload.")
            }
        };

        while let Some(mut field) = multipart.next_field().await.map_err(multipart_error)? {
            if field.name() != Some(MULTIPART_FIELD) {
                continue;
            }

            let name = field.file_name().and_then(display_file_name);
            let mut bytes = Vec::new();
            while let Some(chunk) = field.chunk().await.map_err(multipart_error)? {
                if bytes.len() + chunk.len() > max_bytes {
                    return Err(file_too_large(max_bytes));
                }
                bytes.extend_from_slice(&chunk);
            }

            return Ok(Self { bytes, name });
        }

        Err(AppError::bad_request("No file was sent."))
    }
}

/// Only the last path segment of a client-supplied name, without control
/// characters; anything unusable is dropped rather than failing the upload.
fn display_file_name(raw: &str) -> Option<String> {
    let base = raw.rsplit(['/', '\\']).next()?.trim();
    let valid = !base.is_empty()
        && base.chars().count() <= FILE_NAME_MAX_CHARS
        && !base.chars().any(char::is_control);

    valid.then(|| base.to_owned())
}

fn file_too_large(max_bytes: usize) -> AppError {
    AppError::FileTooLarge {
        max_bytes: max_bytes as u64,
    }
}

/// A file whose content was recognised, with the preview an office document
/// carries.
struct IdentifiedFile {
    bytes: Vec<u8>,
    kind: FileKind,
    thumbnail: Option<Vec<u8>>,
}

async fn identify(bytes: Vec<u8>) -> AppResult<IdentifiedFile> {
    if let Some(kind) = file_kind::sniff(&bytes) {
        return Ok(IdentifiedFile {
            bytes,
            kind,
            thumbnail: None,
        });
    }
    if !file_kind::is_zip(&bytes) {
        return Err(AppError::UnsupportedFile);
    }

    let (bytes, document) = tokio::task::spawn_blocking(move || {
        let document = file_kind::inspect_office(&bytes);
        (bytes, document)
    })
    .await
    .map_err(|e| AppError::internal(format!("Office inspection failed: {e}")))?;
    let document = document.ok_or(AppError::UnsupportedFile)?;

    Ok(IdentifiedFile {
        bytes,
        kind: FileKind::Office(document.format),
        thumbnail: document.thumbnail,
    })
}

/// Fails unless `asset_id` names an upload of `uploader` for `purpose` that is
/// still within its claim window.
pub async fn ensure_claimable<'e>(
    db: impl PgExecutor<'e>,
    asset_id: Uuid,
    purpose: AssetPurpose,
    uploader: Uuid,
) -> AppResult<()> {
    let claimable = sqlx::query_scalar!(
        r#"SELECT EXISTS (
               SELECT 1 FROM assets
               WHERE id = $1 AND purpose = $2 AND uploaded_by = $3
                 AND uploaded_at > now() - make_interval(hours => $4)
           ) AS "claimable!""#,
        asset_id,
        purpose as AssetPurpose,
        uploader,
        CLAIM_WINDOW_HOURS
    )
    .fetch_one(db)
    .await?;

    if claimable {
        Ok(())
    } else {
        Err(invalid_upload())
    }
}

pub fn invalid_upload() -> AppError {
    AppError::bad_request("The upload is invalid, expired or already in use.")
}

pub struct AssetService {
    db: PgPool,
    cloudinary: Cloudinary,
}

impl AssetService {
    pub fn from_state(s: &AppState) -> Self {
        Self {
            db: s.db.clone(),
            cloudinary: s.cloudinary.clone(),
        }
    }

    /// Stores a file for a task. Office documents bring their preview image
    /// along, which is stored as an asset of its own.
    pub async fn upload_attachment(
        &self,
        uploader: Uuid,
        file: ReceivedFile,
    ) -> AppResult<UploadDto> {
        let identified = identify(file.bytes).await?;
        let kind = identified.kind;
        if identified.bytes.len() > kind.max_bytes() {
            return Err(file_too_large(kind.max_bytes()));
        }

        let thumbnail = match identified
            .thumbnail
            .and_then(|bytes| Some((file_kind::sniff(&bytes)?, bytes)))
        {
            Some((thumbnail_kind, bytes)) => {
                self.store_thumbnail(uploader, thumbnail_kind, bytes).await
            }
            None => None,
        };

        let stored = self
            .store(
                uploader,
                AssetPurpose::Attachment,
                kind,
                identified.bytes,
                file.name.clone(),
                thumbnail.as_ref(),
            )
            .await?;

        Ok(UploadDto {
            id: stored.id,
            file: FileDto {
                public_id: stored.public_id,
                resource_type: kind.resource_type(),
                format: kind.format().to_owned(),
                width: stored.width,
                height: stored.height,
                name: file.name,
                thumbnail_public_id: thumbnail.map(|t| t.public_id),
            },
        })
    }

    /// A document is still worth storing when its preview is not, so a
    /// failing preview only costs the preview.
    async fn store_thumbnail(
        &self,
        uploader: Uuid,
        kind: FileKind,
        bytes: Vec<u8>,
    ) -> Option<StoredAsset> {
        self.store(uploader, AssetPurpose::Thumbnail, kind, bytes, None, None)
            .await
            .inspect_err(|e| tracing::warn!("Storing an office preview failed: {e:?}"))
            .ok()
    }

    /// Group pictures are images only; they are cropped in the browser.
    pub async fn upload_group_avatar(
        &self,
        uploader: Uuid,
        file: ReceivedFile,
    ) -> AppResult<GroupAvatarUploadDto> {
        let kind = file_kind::sniff(&file.bytes)
            .filter(|kind| matches!(kind, FileKind::Image(_)))
            .ok_or(AppError::UnsupportedFile)?;
        if file.bytes.len() > kind.max_bytes() {
            return Err(file_too_large(kind.max_bytes()));
        }

        let stored = self
            .store(
                uploader,
                AssetPurpose::GroupAvatar,
                kind,
                file.bytes,
                None,
                None,
            )
            .await?;

        Ok(GroupAvatarUploadDto {
            id: stored.id,
            url: self.cloudinary.image_url(&stored.public_id),
        })
    }

    /// Records the asset before uploading it, so no file can reach Cloudinary
    /// without the sweep knowing about it, not even if the server stops
    /// midway. A failed upload takes its record with it.
    async fn store(
        &self,
        uploader: Uuid,
        purpose: AssetPurpose,
        kind: FileKind,
        bytes: Vec<u8>,
        name: Option<String>,
        thumbnail: Option<&StoredAsset>,
    ) -> AppResult<StoredAsset> {
        let resource_type = kind.resource_type();
        let raw_extension = match kind {
            FileKind::Office(office) => Some(office.extension()),
            FileKind::Image(_) | FileKind::Pdf => None,
        };
        let folder = purpose.folder();
        let public_id = folder.new_public_id(raw_extension);

        let id = sqlx::query_scalar!(
            r#"INSERT INTO assets
                   (public_id, resource_type, purpose, format, original_name, thumbnail_id, uploaded_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id"#,
            public_id,
            resource_type as ResourceType,
            purpose as AssetPurpose,
            kind.format(),
            name,
            thumbnail.map(|t| t.id),
            uploader
        )
        .fetch_one(&self.db)
        .await?;

        let uploaded = match self
            .cloudinary
            .upload(&public_id, folder, resource_type, bytes)
            .await
        {
            Ok(uploaded) => uploaded,
            Err(e) => {
                if let Err(cleanup) = sqlx::query!(r#"DELETE FROM assets WHERE id = $1"#, id)
                    .execute(&self.db)
                    .await
                {
                    tracing::warn!(%id, "Failed to forget an asset whose upload failed: {cleanup}");
                }
                return Err(match e {
                    CloudinaryError::Rejected(reason) => {
                        tracing::info!(%reason, "Cloudinary refused an uploaded file");
                        AppError::UnsupportedFile
                    }
                    CloudinaryError::Http(e) => {
                        AppError::internal(format!("Cloudinary upload failed: {e}"))
                    }
                });
            }
        };

        let width = uploaded.width.filter(|&w| w > 0);
        let height = uploaded.height.filter(|&h| h > 0);
        sqlx::query!(
            r#"UPDATE assets SET width = $2, height = $3 WHERE id = $1"#,
            id,
            width,
            height
        )
        .execute(&self.db)
        .await?;

        Ok(StoredAsset {
            id,
            public_id,
            width,
            height,
        })
    }
}

struct StoredAsset {
    id: Uuid,
    public_id: String,
    width: Option<i32>,
    height: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_keep_only_their_last_segment() {
        assert_eq!(
            display_file_name("Blatt 3.docx").as_deref(),
            Some("Blatt 3.docx")
        );
        assert_eq!(
            display_file_name(r"C:\Users\a\Blatt.pptx").as_deref(),
            Some("Blatt.pptx")
        );
        assert_eq!(display_file_name("../../x.xlsx").as_deref(), Some("x.xlsx"));
    }

    #[test]
    fn unusable_file_names_are_dropped() {
        assert_eq!(display_file_name(""), None);
        assert_eq!(display_file_name("dir/"), None);
        assert_eq!(display_file_name("a\nb.docx"), None);
        assert_eq!(display_file_name(&"a".repeat(256)), None);
    }
}
