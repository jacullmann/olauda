import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { apiErrorMessage } from '@/api/errors';
import { useAbsoluteUrl } from '@/common/composables/useAbsoluteUrl';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { Task } from '@/modules/tasks/types';
import { taskRoute } from '@/modules/tasks/utils/routes';

/** Deleting, reporting and sharing a task. */
export function useTaskActions(
  groupId: string,
  removeFromList: (taskId: string) => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { absoluteUrl } = useAbsoluteUrl();

  const showReportConfirm = ref(false);
  const reportReason = ref('');
  const reportTarget = ref<Task | null>(null);

  /** Resolves to whether the task is gone, so a view of it knows to close. */
  async function deleteItem(taskId: string): Promise<boolean> {
    const isConfirmed = await confirmModal.ask({
      title: t('tasks.actions.delete_modal.title'),
      content: t('tasks.actions.delete_modal.message'),
      submitText: t('tasks.actions.delete_modal.submit'),
      danger: true,
    });
    if (!isConfirmed) return false;

    try {
      await api.delete(groupPath(groupId, `/items/${taskId}`));
      removeFromList(taskId);
      toast.success(t('tasks.actions.delete_modal.success'));
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.errors.delete')));
      return false;
    }
  }

  function reportItem(task: Task) {
    reportTarget.value = task;
    reportReason.value = '';
    showReportConfirm.value = true;
  }

  function cancelReport() {
    showReportConfirm.value = false;
    reportTarget.value = null;
    reportReason.value = '';
  }

  async function doReport() {
    const task = reportTarget.value;
    if (!task) return;
    const reason = reportReason.value;
    cancelReport();

    try {
      await api.post(groupPath(groupId, '/items/reports'), {
        itemId: task.id,
        itemTitle: task.title,
        reason,
      });
      toast.success(t('tasks.list.tasks.menu.report.success'));
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.errors.report')));
    }
  }

  async function shareItem(task: Task) {
    const shareUrl = absoluteUrl(taskRoute(groupId, task.id));

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
      } catch (err) {
        console.error('Teilen abgebrochen:', err);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('tasks.list.tasks.menu.share_copied'));
    } catch {
      toast.error(t('common.errors.copy_link'));
    }
  }

  return {
    showReportConfirm,
    reportReason,
    reportItem,
    doReport,
    cancelReport,
    deleteItem,
    shareItem,
  };
}
