import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api.ts';
import { groupPath } from '@/api/groupPath';
import { uploadTaskFile, type Attachment } from '@/api/files';
import { processImageBeforeUpload } from '@/modules/tasks/composables/useConvertImage';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/stores/userStore';
import type { Task, TaskFile } from '@/modules/tasks/types';
import {
  imageQuotaViolation,
  type HeldImages,
  type ImageQuotaViolation,
} from '@/modules/tasks/utils/imageQuota';

const BYTES_PER_MB = 1024 * 1024;
// Mirror the server's limits, so an oversized selection is refused before it
// is sent. Images are measured after compression, so a large phone photo still
// fits; documents are uploaded as they are and get more room.
const MAX_IMAGE_BYTES = 2 * BYTES_PER_MB;
const MAX_DOCUMENT_BYTES = 5 * BYTES_PER_MB;
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const DOCUMENT_EXTENSION = /\.(pdf|docx|pptx|xlsx)$/i;
export const ACCEPTED_FILES = 'image/*,application/pdf,.docx,.pptx,.xlsx';

const isImage = (file: File) => file.type.startsWith('image/');
/** A first filter for the picker; the server decides by the file's content. */
const isSupported = (file: File) =>
  isImage(file) ||
  DOCUMENT_TYPES.has(file.type) ||
  DOCUMENT_EXTENSION.test(file.name);
const maxBytesOf = (file: File) =>
  isImage(file) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;

const images = ref<TaskFile[]>([]);
const uploading = ref(false);
const uploadError = ref('');
const uploadSuccess = ref(false);

/** Uploads attach to items of the current `groupId`. */
export function useImageUpload(groupId: MaybeRefOrGetter<string>) {
  const { t } = useI18n();
  const toast = useToast();
  const userStore = useUserStore();

  function failUpload(message: string) {
    uploadError.value = message;
    uploading.value = false;
    toast.error(message);
  }

  function init(initialImages: TaskFile[] = []) {
    images.value = [...initialImages];
    uploading.value = false;
    uploadError.value = '';
    uploadSuccess.value = false;
  }

  /** Without an `itemId` the images belong to a task not created yet. */
  function heldImages(itemId?: string): HeldImages {
    const total = images.value.length;
    if (!itemId) return { own: total, total };

    const userId = userStore.user?.id;
    const own = images.value.filter(
      (file) => 'createdBy' in file && file.createdBy === userId,
    ).length;
    return { own, total };
  }

  function quotaMessage({ limit, max, remaining }: ImageQuotaViolation) {
    const scope = limit === 'perUploader' ? 'own' : 'task';
    return remaining === 0
      ? t(`tasks.images.errors.${scope}_quota_reached`, { max })
      : t(`tasks.images.errors.${scope}_quota_exceeded`, { max, remaining });
  }

  async function uploadFiles(
    files: File[],
    itemType: Task['type'],
    itemId?: string,
  ) {
    if (files.length === 0) return;

    uploading.value = true;
    uploadError.value = '';
    uploadSuccess.value = false;

    const validFilesList = files.filter(isSupported);

    if (validFilesList.length === 0) {
      uploading.value = false;
      return;
    }

    // A selection that does not fit is rejected as a whole rather than cut
    // down, so the member decides which files to leave out.
    const violation = imageQuotaViolation(
      itemType,
      heldImages(itemId),
      validFilesList.length,
    );
    if (violation) {
      failUpload(quotaMessage(violation));
      return;
    }

    // Every file is prepared and measured before the first upload starts, so
    // one oversized file stops the whole selection like the quota does.
    const prepared = await Promise.all(
      validFilesList.map(async (original) => ({
        original,
        file: await processImageBeforeUpload(original),
      })),
    );
    const oversized = prepared.find(({ file }) => file.size > maxBytesOf(file));
    if (oversized) {
      failUpload(
        t('tasks.images.errors.file_too_large', {
          name: oversized.original.name,
          max: maxBytesOf(oversized.file) / BYTES_PER_MB,
        }),
      );
      return;
    }
    const preparedFiles = prepared.map(({ file }) => file);

    const progressToast = toast.progress(
      t('tasks.images.upload.progress'),
      preparedFiles.length,
    );

    try {
      // A file for an existing task is attached right away; for a new task it
      // waits in the form until the task is created.
      const uploadFile = async (file: File) => {
        const upload = await uploadTaskFile(toValue(groupId), file);

        if (!itemId) {
          images.value.push(upload);
          return;
        }

        const { data: attachment } = await api.post<Attachment>(
          groupPath(toValue(groupId), `/items/${itemId}/attachments`),
          { assetId: upload.id },
        );
        images.value.push(attachment);
      };

      const results = await Promise.allSettled(
        preparedFiles.map((file) =>
          uploadFile(file).finally(() => progressToast.increment()),
        ),
      );

      const uploaded = results.filter((r) => r.status === 'fulfilled').length;

      if (uploaded === preparedFiles.length) {
        uploadSuccess.value = true;
        progressToast.settle(t('tasks.images.upload.success'));
      } else if (uploaded > 0) {
        uploadError.value = t('tasks.images.errors.upload_partial', {
          uploaded,
          total: preparedFiles.length,
        });
        progressToast.settle(uploadError.value, { type: 'warning' });
      } else {
        uploadError.value = t('tasks.images.errors.upload');
        progressToast.settle(uploadError.value, { type: 'error' });
      }
    } catch {
      uploadError.value = t('tasks.images.errors.upload');
      progressToast.settle(uploadError.value, { type: 'error' });
    } finally {
      uploading.value = false;
    }
  }

  function uploadImage(itemType: Task['type'], itemId?: string) {
    uploading.value = true;
    uploadError.value = '';
    uploadSuccess.value = false;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_FILES;
    input.multiple = true;

    input.oncancel = () => {
      uploading.value = false;
    };

    input.onchange = async () => {
      const files = Array.from(input.files || []);
      await uploadFiles(files, itemType, itemId);
    };

    input.click();
  }

  /** `parentId` names the task an attachment belongs to; without it the file
   * is an upload of a task not created yet and only leaves the form. */
  async function removeImg(file: TaskFile, parentId?: string) {
    if (parentId) {
      try {
        await api.delete(
          groupPath(
            toValue(groupId),
            `/items/${parentId}/attachments/${file.id}`,
          ),
        );
        images.value = images.value.filter((i) => i.id !== file.id);
        toast.success(t('tasks.images.delete_modal.success'));
      } catch {
        uploadError.value = t('tasks.images.errors.delete');
      }
    } else {
      images.value = images.value.filter((i) => i.id !== file.id);
    }
  }

  return {
    images,
    uploading,
    uploadError,
    uploadSuccess,
    init,
    uploadImage,
    uploadFiles,
    removeImg,
  };
}
