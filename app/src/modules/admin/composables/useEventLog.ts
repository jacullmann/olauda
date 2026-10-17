import { computed } from 'vue';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import { isUuid } from '@/common/utils/uuid';
import type {
  EventLogQuery,
  EventOutcome,
  EventSource,
  SortOrder,
} from '@/modules/admin/types';
import { eventLogQuery } from '@/modules/admin/utils/adminQueries';
import {
  EVENT_SOURCES,
  isDateKey,
  localDayStart,
} from '@/modules/admin/utils/eventLog';
import { useRouteQueryState, useSearchInput } from './useRouteQueryState';

const OUTCOMES = [
  'success',
  'failure',
] as const satisfies readonly EventOutcome[];
const ORDERS = ['desc', 'asc'] as const satisfies readonly SortOrder[];

/** Loose enough for IPv4 and IPv6; the server parses the address for real. */
const IP_PATTERN = /^[0-9a-f.:]+$/i;
const TYPE_PATTERN = /^[a-z][a-z_:-]*$/;
const CATEGORY_PATTERN = /^[a-z][a-z-]*$/;

/** An empty string is a filter that is not set. */
export type EventLogFilters = {
  search: string;
  source: '' | EventSource;
  category: string;
  type: string;
  outcome: '' | EventOutcome;
  ip: string;
  /** What happened to this account as well as what it did. */
  userId: string;
  groupId: string;
  /** The first local day shown, as `YYYY-MM-DD`. */
  from: string;
  /** The last local day shown, as `YYYY-MM-DD`. */
  to: string;
  order: SortOrder;
};

const DEFAULTS: EventLogFilters = {
  search: '',
  source: '',
  category: '',
  type: '',
  outcome: '',
  ip: '',
  userId: '',
  groupId: '',
  from: '',
  to: '',
  order: 'desc',
};

export type EventLogState = 'loading' | 'ready' | 'failed';

/**
 * The security and activity log as one timeline, filtered by the URL query
 * and loaded page by page as it is scrolled. The detail pages of accounts and
 * groups link here with the filter for them set.
 */
export function useEventLog() {
  const queryClient = useQueryClient();
  const { params, isDefault, setParams } = useRouteQueryState<EventLogFilters>({
    defaults: DEFAULTS,
    rules: {
      source: EVENT_SOURCES,
      category: (raw) => CATEGORY_PATTERN.test(raw),
      type: (raw) => TYPE_PATTERN.test(raw),
      outcome: OUTCOMES,
      ip: (raw) => IP_PATTERN.test(raw),
      userId: isUuid,
      groupId: isUuid,
      from: isDateKey,
      to: isDateKey,
      order: ORDERS,
    },
  });
  const searchInput = useSearchInput(
    () => params.value.search,
    (search) => setParams({ search }, true),
  );

  const hasFilters = computed(() =>
    (Object.keys(DEFAULTS) as (keyof EventLogFilters)[]).some(
      (key) => key !== 'order' && !isDefault(key),
    ),
  );

  function clearFilters() {
    return setParams({ ...DEFAULTS, order: params.value.order });
  }

  const apiQuery = computed<EventLogQuery>(() => {
    const p = params.value;
    const set = (value: string) => value || undefined;
    return {
      userId: set(p.userId),
      search: set(p.search),
      source: p.source || undefined,
      category: set(p.category),
      type: set(p.type),
      outcome: p.outcome || undefined,
      ip: set(p.ip),
      groupId: set(p.groupId),
      from: p.from ? localDayStart(p.from) : undefined,
      to: p.to ? localDayStart(p.to, 1) : undefined,
      order: p.order,
    };
  });

  // Changed filters keep the entries shown so far, dimmed, until theirs arrive.
  const query = useInfiniteQuery(
    computed(() => ({
      ...eventLogQuery(apiQuery.value),
      placeholderData: keepPreviousData,
      // Any refetch of an infinite query reloads every page scrolled through,
      // one after the other, and that includes invalidations, which ignore
      // `staleTime`. So a filter's log loads by itself only until it has
      // data; after that only `reload` and scrolling on fetch, as a disabled
      // query skips focus, reconnect, mount and invalidation refetches.
      enabled: () => (cached: { state: { data: unknown } }) =>
        cached.state.data === undefined,
    })),
  );

  const entries = computed(
    () => query.data.value?.pages.flatMap((page) => page.items) ?? [],
  );
  const total = computed(() => query.data.value?.pages[0]?.total ?? null);

  const state = computed<EventLogState>(() => {
    if (query.isError.value && !query.isFetchNextPageError.value) {
      return query.isFetching.value ? 'loading' : 'failed';
    }
    if (
      query.isPending.value ||
      query.isPlaceholderData.value ||
      (query.isFetching.value && !query.isFetchingNextPage.value)
    ) {
      return 'loading';
    }
    return 'ready';
  });

  function loadMore() {
    if (!query.hasNextPage.value || query.isFetching.value) return;
    if (state.value !== 'ready') return;
    void query.fetchNextPage();
  }

  /** Starts over from the first page, as a refetch would load every page again. */
  function reload() {
    queryClient.setQueryData(
      eventLogQuery(apiQuery.value).queryKey,
      (data) =>
        data && {
          pages: data.pages.slice(0, 1),
          pageParams: data.pageParams.slice(0, 1),
        },
    );
    void query.refetch();
  }

  // A log kept from an earlier visit is shown while its newest page reloads.
  if (query.data.value) reload();

  return {
    params,
    setFilters: setParams,
    searchInput,
    hasFilters,
    clearFilters,
    entries,
    total,
    hasMore: query.hasNextPage,
    state,
    loadingMore: query.isFetchingNextPage,
    loadMoreFailed: query.isFetchNextPageError,
    loadMore,
    reload,
  };
}
