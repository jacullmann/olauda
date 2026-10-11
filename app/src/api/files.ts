import api from './client';
import { groupPath } from './groupPath';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
// Lets development point delivery at the mock server's Cloudinary stand-in.
const DELIVERY_BASE =
  (import.meta.env.VITE_CLOUDINARY_DELIVERY_URL as string | undefined) ||
  `https://res.cloudinary.com/${CLOUD_NAME}`;
const PREVIEW_TRANSFORM = 'f_auto,q_auto,w_256,h_256,c_fill';
const FULL_IMAGE_TRANSFORM = 'f_auto,q_auto';

/** Images (and PDFs) can be transformed on delivery; raw files cannot. */
export type ResourceType = 'image' | 'raw';

/** A file the server verified and stored, as the API describes it. */
export interface StoredFile {
  publicId: string;
  resourceType: ResourceType;
  /** Lower-case file extension, e.g. `jpg`, `pdf` or `docx`. */
  format: string;
  width: number | null;
  height: number | null;
  /** The name the file had on the uploader's device. */
  name: string | null;
  /** The preview image an office document carries. */
  thumbnailPublicId: string | null;
}

/** A file that is not attached yet; its `id` attaches it to a task. */
export interface Upload extends StoredFile {
  id: string;
}

export interface Attachment extends StoredFile {
  id: string;
  createdBy: string | null;
}

export interface GroupAvatarUpload {
  id: string;
  url: string;
}

const FILE_FIELD = 'file';

function fileForm(file: Blob, name?: string): FormData {
  const form = new FormData();
  form.append(FILE_FIELD, file, name);
  return form;
}

/** Uploads a file for a task of the group; attach it by its `id` afterwards. */
export async function uploadTaskFile(
  groupId: string,
  file: File,
): Promise<Upload> {
  const { data } = await api.post<Upload>(
    groupPath(groupId, '/items/uploads'),
    fileForm(file, file.name),
  );
  return data;
}

export async function uploadGroupAvatar(
  image: Blob,
): Promise<GroupAvatarUpload> {
  const { data } = await api.post<GroupAvatarUpload>(
    '/uploads/group-avatar',
    fileForm(image, 'avatar'),
  );
  return data;
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
