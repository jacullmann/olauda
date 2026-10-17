import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { uploadTaskFile } from '@/api/files';
import { processImageBeforeUpload } from '@/modules/tasks/utils/imageConversion';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import type { TaskFile, TaskType } from '@/modules/tasks/types';
import { taskKeys } from '@/modules/tasks/utils/taskQueries';
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
  const queryClient = useQueryClient();

  // Every view of a task shows its files, the list's cards included.
  const reloadTasks = () =>
    void queryClient.invalidateQueries({
      queryKey: taskKeys.all(toValue(groupId)),
    });

  // A selection of several files is reloaded once, after the last of them.
  const attachment = useMutation({
    mutationFn: ({ itemId, assetId }: { itemId: string; assetId: string }) =>
      unwrap(
        api.POST('/groups/{group_id}/items/{id}/attachments', {
          params: { path: { group_id: toValue(groupId), id: itemId } },
          body: { assetId },
        }),
      ),
  });

  const attachmentRemoval = useMutation({
    mutationFn: ({ itemId, fileId }: { itemId: string; fileId: string }) =>
      unwrap(
        api.DELETE(
          '/groups/{group_id}/items/{id}/attachments/{attachment_id}',
          {
            params: {
              path: {
                group_id: toValue(groupId),
                id: itemId,
                attachment_id: fileId,
              },
            },
          },
        ),
      ),
    onSuccess: reloadTasks,
  });

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
    itemType: TaskType,
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

        images.value.push(
          await attachment.mutateAsync({ itemId, assetId: upload.id }),
        );
      };

      const results = await Promise.allSettled(
        preparedFiles.map((file) =>
          uploadFile(file).finally(() => progressToast.increment()),
        ),
      );

      const uploaded = results.filter((r) => r.status === 'fulfilled').length;
      if (itemId && uploaded > 0) reloadTasks();

      if (uploaded === preparedFiles.length) {
        uploadSuccess.value = true;
        progressToast.dismiss();
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

  function uploadImage(itemType: TaskType, itemId?: string) {
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

  /**
   * `parentId` names the task an attachment belongs to; without it the file
   * is an upload of a task not created yet and only leaves the form.
   * Resolves to whether the file is gone.
   */
  async function removeImg(file: TaskFile, parentId?: string) {
    if (parentId) {
      try {
        await attachmentRemoval.mutateAsync({
          itemId: parentId,
          fileId: file.id,
        });
      } catch (e) {
        uploadError.value = apiErrorMessage(e, t('tasks.images.errors.delete'));
        return false;
      }
    }
    images.value = images.value.filter((i) => i.id !== file.id);
    return true;
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
