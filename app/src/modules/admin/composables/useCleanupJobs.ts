import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { useToast } from '@/common/composables/useToast';
import type { CleanupJob } from '../types';

/**
 * The health of the scheduled cleanups. Fetched fresh whenever the overview
 * opens, since a stalled job is exactly what an admin looks there to spot.
 */
export function useCleanupJobs() {
  const { t } = useI18n();
  const toast = useToast();
  const jobs = ref<CleanupJob[]>([]);
  const loading = ref(false);
  const failed = ref(false);

  async function loadJobs() {
    loading.value = true;
    failed.value = false;
    try {
      const { data } = await api.get<CleanupJob[]>('/admin/cleanup-jobs');
      jobs.value = data;
    } catch {
      failed.value = true;
      toast.error(t('admin.overview.cleanup_jobs.errors.load'));
    } finally {
      loading.value = false;
    }
  }

  return { jobs, loading, failed, loadJobs };
}
