import api, { unwrap } from './client';
import type {
  AttachmentDto,
  FileDto,
  GroupAvatarUploadDto,
  UploadDto,
} from './schema';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
// Lets development point delivery at the mock server's Cloudinary stand-in.
const DELIVERY_BASE =
  (import.meta.env.VITE_CLOUDINARY_DELIVERY_URL as string | undefined) ||
  `https://res.cloudinary.com/${CLOUD_NAME}`;
const PREVIEW_TRANSFORM = 'f_auto,q_auto,w_256,h_256,c_fill';
const FULL_IMAGE_TRANSFORM = 'f_auto,q_auto';

/** A file the server verified and stored, as the API describes it. */
export type StoredFile = FileDto;

/** A file that is not attached yet; its `id` attaches it to a task. */
export type Upload = UploadDto;

export type Attachment = AttachmentDto;

export type GroupAvatarUpload = GroupAvatarUploadDto;

/** Sends the file as the multipart form every upload endpoint reads. */
function fileForm({ file }: { file: Blob }, name?: string): FormData {
  const form = new FormData();
  form.append('file', file, name);
  return form;
}

/** Uploads a file for a task of the group; attach it by its `id` afterwards. */
export function uploadTaskFile(groupId: string, file: File): Promise<Upload> {
  return unwrap(
    api.POST('/groups/{group_id}/items/uploads', {
      params: { path: { group_id: groupId } },
      body: { file },
      bodySerializer: (body) => fileForm(body, file.name),
    }),
  );
}

export function uploadGroupAvatar(image: Blob): Promise<GroupAvatarUpload> {
  return unwrap(
    api.POST('/uploads/group-avatar', {
      body: { file: image },
      bodySerializer: (body) => fileForm(body, 'avatar'),
    }),
  );
}

export const isPdf = (file: StoredFile) => file.format === 'pdf';

export const isOfficeDocument = (file: StoredFile) =>
  file.resourceType === 'raw';

/** The file itself: a delivery-optimised image, the PDF or the raw document. */
export function fileUrl(file: StoredFile): string {
  if (isOfficeDocument(file)) {
    return `${DELIVERY_BASE}/raw/upload/${file.publicId}`;
  }
  if (isPdf(file)) {
    return `${DELIVERY_BASE}/image/upload/${file.publicId}.pdf`;
  }
  return `${DELIVERY_BASE}/image/upload/${FULL_IMAGE_TRANSFORM}/${file.publicId}`;
}

/**
 * A square preview: the image itself, the first page of a PDF or the preview
 * an office document carries. `null` for an office document without one.
 */
export function previewUrl(file: StoredFile): string | null {
  const source = isOfficeDocument(file)
    ? file.thumbnailPublicId
    : file.publicId;
  if (!source) return null;

  const page = isPdf(file) ? ',pg_1' : '';
  return `${DELIVERY_BASE}/image/upload/${PREVIEW_TRANSFORM}${page}/${source}`;
}
