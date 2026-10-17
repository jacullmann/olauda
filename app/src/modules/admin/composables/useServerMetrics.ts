import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { ErrorCode } from '@/api/schema';
import { apiErrorCode, apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import type { MetricsRange } from '@/modules/admin/types';
import { serverMetricsQuery } from '@/modules/admin/utils/adminQueries';

/** Why the metrics could not be loaded, told apart where an admin can act on it. */
type ServerMetricsFailure =
  'token_rejected' | 'server_not_found' | 'unreachable' | 'load';

const FAILURE_BY_CODE: Partial<Record<ErrorCode, ServerMetricsFailure>> = {
  HETZNER_TOKEN_REJECTED: 'token_rejected',
  HETZNER_SERVER_NOT_FOUND: 'server_not_found',
  HETZNER_UNREACHABLE: 'unreachable',
};

function failureOf(error: unknown): ServerMetricsFailure {
  const code = apiErrorCode(error);
  return (code && FAILURE_BY_CODE[code]) || 'load';
}

export const METRICS_RANGES: readonly MetricsRange[] = [
  '1h',
  '24h',
  '7d',
  '30d',
];
const DEFAULT_RANGE: MetricsRange = '24h';

export function isMetricsRange(value: unknown): value is MetricsRange {
  return METRICS_RANGES.includes(value as MetricsRange);
}

/**
 * The server's load as Hetzner measures it, over a window kept in the URL
 * query so a view survives reloads and can be linked.
 */
export function useServerMetrics() {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const routeName = route.name;

  // Leaving the page drops the query, which must not load the default range.
  const range = computed<MetricsRange>((previous) => {
    if (previous && route.name !== routeName) return previous;
    return isMetricsRange(route.query.range)
      ? route.query.range
      : DEFAULT_RANGE;
  });

  // Another range keeps the charts on screen, dimmed, until it arrived.
  const query = useQuery(
    computed(() => ({
      ...serverMetricsQuery(range.value),
      placeholderData: keepPreviousData,
    })),
  );

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(
      error,
      t(`admin.overview.server.errors.${failureOf(error)}`),
    ),
  );

  function setRange(next: MetricsRange) {
    return router.replace({
      name: routeName ?? undefined,
      query: {
        ...route.query,
        range: next === DEFAULT_RANGE ? undefined : next,
      },
    });
  }

  function load() {
    void query.refetch();
  }

  return {
    range,
    metrics: computed(() => query.data.value ?? null),
    loading: query.isPlaceholderData,
    failed: computed(() => query.isError.value && !query.isFetching.value),
    setRange,
    load,
  };
}
