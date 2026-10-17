import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery } from '@tanstack/vue-query';
import { apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { cleanupJobsQuery } from '@/modules/admin/utils/adminQueries';

/** The health of the scheduled cleanups. */
export function useCleanupJobs() {
  const { t } = useI18n();
  const query = useQuery(cleanupJobsQuery());

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('admin.overview.cleanup_jobs.errors.load')),
  );

  const hasJobs = computed(() => query.data.value !== undefined);

  function loadJobs() {
    void query.refetch();
  }

  return {
    jobs: computed(() => query.data.value ?? []),
    loading: computed(() => !hasJobs.value && query.isFetching.value),
    failed: computed(
      () => !hasJobs.value && query.isError.value && !query.isFetching.value,
    ),
    loadJobs,
  };
}
