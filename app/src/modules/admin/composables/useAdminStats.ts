import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery } from '@tanstack/vue-query';
import { apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import {
  adminStatsQuery,
  dailyActivityQuery,
  weeklyRhythmQuery,
} from '@/modules/admin/utils/adminQueries';

/** The platform's headline numbers and how it was used over the last weeks. */
export function useAdminStats() {
  const { t } = useI18n();

  const statsQuery = useQuery(adminStatsQuery());
  const dailyQuery = useQuery(dailyActivityQuery());
  const rhythmQuery = useQuery(weeklyRhythmQuery());

  const queries = [statsQuery, dailyQuery, rhythmQuery];

  // The parts usually fail together, which is told once.
  useLoadErrorToast(
    {
      error: computed(() => queries.find((q) => q.error.value)?.error.value),
      isLoadingError: computed(() =>
        queries.some((q) => q.isLoadingError.value),
      ),
      isSuccess: computed(() => queries.every((q) => q.isSuccess.value)),
    },
    (error) => apiErrorMessage(error, t('admin.overview.errors.load')),
  );

  return {
    stats: computed(() => statsQuery.data.value ?? null),
    dailyActivity: computed(() => dailyQuery.data.value ?? []),
    weeklyRhythm: computed(() => rhythmQuery.data.value ?? null),
    loadingStats: statsQuery.isPending,
  };
}
