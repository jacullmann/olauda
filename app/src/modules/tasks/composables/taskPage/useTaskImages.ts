import { reactive, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { Attachment, Task } from '@/modules/tasks/types';
import type { TaskPermissions } from '../useTaskPermissions';
import type { useImageUpload } from '../useImageUpload';

interface TaskImagesOptions {
  isLoggedIn: Readonly<Ref<boolean>>;
  imageUpload: ReturnType<typeof useImageUpload>;
  permissions: TaskPermissions;
  refreshTask: (taskId: string) => Promise<void>;
}

/** Uploading and deleting a task's images, and the menu an image opens. */
export function useTaskImages({
  isLoggedIn,
  imageUpload,
  permissions,
  refreshTask,
}: TaskImagesOptions) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();

  const imageMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    item: null as Task | null,
    image: null as Attachment | null,
  });

  const deletingImage = ref(false);
  const uploadingForTaskId = ref<string | null>(null);

  function handleImageContextMenu(
    event: MouseEvent,
    task: Task,
    img: Attachment,
  ) {
    if (!isLoggedIn.value) return;
    const hasActions =
      permissions.canUploadImages.value ||
      permissions.canDeleteImage(task, img);
    if (!hasActions) return;
    imageMenu.item = task;
    imageMenu.image = img;
    imageMenu.x = event.clientX;
    imageMenu.y = event.clientY;
    imageMenu.visible = true;
    imageUpload.init(task.attachments);
  }

  function closeImageMenu() {
    imageMenu.visible = false;
    imageMenu.item = null;
    imageMenu.image = null;
  }

  function triggerImageUpload(task?: Task) {
    const target = task ?? imageMenu.item;
    if (!target || !permissions.canUploadImages.value) return;

    imageUpload.init(target.attachments);
    uploadingForTaskId.value = target.id;
    imageUpload.uploadImage(target.type, target.id);
    closeImageMenu();
  }

  function triggerImageDrop(task: Task, files: File[]) {
    if (!files.length || !permissions.canUploadImages.value) return;

    imageUpload.init(task.attachments);
    uploadingForTaskId.value = task.id;
    void imageUpload.uploadFiles(files, task.type, task.id);
  }

  async function triggerImageDelete() {
    const { image, item: task } = imageMenu;
    if (!image || !task || deletingImage.value) return;

    closeImageMenu();

    const isConfirmed = await confirmModal.ask({
      title: t('tasks.images.delete_modal.title'),
      content: t('tasks.images.delete_modal.message'),
      submitText: t('tasks.images.delete_modal.submit'),
      danger: true,
    });
    if (!isConfirmed) return;

    deletingImage.value = true;
    try {
      await imageUpload.removeImg(image, task.id);
      await refreshTask(task.id);
      toast.success(t('tasks.images.delete_modal.success'), 3000);
    } catch {
      toast.error(t('tasks.images.errors.delete'), 4000);
    } finally {
      deletingImage.value = false;
    }
  }

  // Feedback lives in the upload progress toast; refresh so partial uploads show up too.
  watch(imageUpload.uploading, async (isUploading, wasUploading) => {
    const taskId = uploadingForTaskId.value;
    if (!wasUploading || isUploading || !taskId) return;
    uploadingForTaskId.value = null;
    await refreshTask(taskId);
  });

  return {
    imageMenu,
    closeImageMenu,
    handleImageContextMenu,
    triggerImageUpload,
    triggerImageDrop,
    triggerImageDelete,
  };
}
