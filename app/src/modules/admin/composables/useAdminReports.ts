import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { adminKeys, reportsQuery } from '@/modules/admin/utils/adminQueries';

export function useAdminReports() {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const query = useQuery(reportsQuery());

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('admin.reports.errors.load')),
  );

  const deletion = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/admin/reports/{id}', { params: { path: { id } } })),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.reports() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.statsSummary() }),
      ]),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t('admin.reports.errors.delete'))),
  });

  async function deleteReport(id: string) {
    const confirmed = await confirmModal.ask({
      title: t('admin.reports.delete_modal.title'),
      content: t('admin.reports.delete_modal.content'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (confirmed) deletion.mutate(id);
  }

  return {
    reports: computed(() => query.data.value ?? []),
    loadingReports: query.isPending,
    deleteReport,
  };
}
