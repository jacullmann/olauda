import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useAbsoluteUrl } from '@/common/composables/useAbsoluteUrl';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { Task } from '@/modules/tasks/types';
import { taskRoute } from '@/modules/tasks/utils/routes';
import { removeCachedTask, taskKeys } from '@/modules/tasks/utils/taskQueries';

/** Deleting, reporting and sharing a task. */
export function useTaskActions(groupId: string) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { absoluteUrl } = useAbsoluteUrl();

  const showReportConfirm = ref(false);
  const reportReason = ref('');
  const reportTarget = ref<Task | null>(null);

  const deletion = useMutation({
    mutationFn: (taskId: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/items/{id}', {
          params: { path: { group_id: groupId, id: taskId } },
        }),
      ),
    onSuccess: (_, taskId) => {
      removeCachedTask(queryClient, groupId, taskId);
      void queryClient.invalidateQueries({
        queryKey: taskKeys.lists(groupId),
      });
    },
  });

  const report = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      unwrap(
        api.POST('/groups/{group_id}/items/reports', {
          params: { path: { group_id: groupId } },
          body: { itemId, reason },
        }),
      ),
  });

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
      await deletion.mutateAsync(taskId);
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
      await report.mutateAsync({ itemId: task.id, reason });
      toast.success(t('tasks.success.report'));
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.errors.report')));
    }
  }

  async function shareItem(task: Task) {
    const shareUrl = absoluteUrl(taskRoute(groupId, task.id));

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
      } catch {
        // Closing the share sheet is the member's choice, not a failure.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('common.success.copy_link'));
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
