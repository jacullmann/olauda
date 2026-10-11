import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { SuperAdminReport } from '../types';
import { useSuperAdminStats } from './useSuperAdminStats';

export function useSuperAdminReports() {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { t } = useI18n();
  const { loadStats } = useSuperAdminStats();

  const reports = ref<SuperAdminReport[]>([]);
  const loadingReports = ref(false);

  async function loadReports() {
    loadingReports.value = true;
    try {
      const { data } = await api.get<SuperAdminReport[]>('/admin/reports');
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
