import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { AdminReport } from '@/modules/admin/types';
import { useAdminStats } from './useAdminStats';

export function useAdminReports() {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { t } = useI18n();
  const { loadStats } = useAdminStats();

  const reports = ref<AdminReport[]>([]);
  const loadingReports = ref(false);

  async function loadReports() {
    loadingReports.value = true;
    try {
      const { data } = await api.get<AdminReport[]>('/admin/reports');
      reports.value = data;
    } catch {
      toast.error(t('admin.reports.errors.load'));
    } finally {
      loadingReports.value = false;
    }
  }

  async function deleteReport(id: string) {
    const confirmed = await confirmModal.ask({
      title: t('admin.reports.delete_modal.title'),
      content: t('admin.reports.delete_modal.content'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/reports/${id}`);
      reports.value = reports.value.filter((r) => r.id !== id);
      await loadStats();
    } catch {
      toast.error(t('admin.reports.errors.delete'));
    }
  }

  return { reports, loadingReports, loadReports, deleteReport };
}
