import { computed, ref, shallowRef, watch } from 'vue';
import axios from 'axios';
import api from '@/api/client';
import { isUuid } from '@/common/utils/uuid';
import type {
  EventLogEntry,
  EventLogPage,
  EventOutcome,
  EventSource,
  SortOrder,
} from '@/modules/admin/types';
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

  // Appended to, never edited in place.
  const entries = shallowRef<EventLogEntry[]>([]);
  const total = ref<number | null>(null);
  const nextCursor = ref<string | null>(null);
  const state = ref<EventLogState>('loading');
  const loadingMore = ref(false);
  const loadMoreFailed = ref(false);

  function request(cursor: string | null, signal: AbortSignal) {
    const p = params.value;
    const set = (value: string) => value || undefined;
    return api.get<EventLogPage>('/admin/events', {
      signal,
      params: {
        userId: set(p.userId),
        search: set(p.search),
        source: set(p.source),
        category: set(p.category),
        type: set(p.type),
        outcome: set(p.outcome),
        ip: set(p.ip),
        groupId: set(p.groupId),
        from: p.from ? localDayStart(p.from) : undefined,
        to: p.to ? localDayStart(p.to, 1) : undefined,
        order: p.order,
        cursor: cursor ?? undefined,
      },
    });
  }

  let controller: AbortController | null = null;

  function restart() {
    controller?.abort();
    controller = new AbortController();
    return controller;
  }

  async function load() {
    const current = restart();
    state.value = 'loading';
    loadingMore.value = false;
    loadMoreFailed.value = false;

    try {
      const { data } = await request(null, current.signal);
      entries.value = data.items;
      total.value = data.total;
      nextCursor.value = data.nextCursor;
      state.value = 'ready';
    } catch (error) {
      if (!axios.isCancel(error)) state.value = 'failed';
    }
  }

  async function loadMore() {
    const cursor = nextCursor.value;
    if (!cursor || loadingMore.value || state.value !== 'ready') return;

    const current = restart();
    loadingMore.value = true;
    loadMoreFailed.value = false;

    try {
      const { data } = await request(cursor, current.signal);
      entries.value = [...entries.value, ...data.items];
      nextCursor.value = data.nextCursor;
    } catch (error) {
      if (!axios.isCancel(error)) loadMoreFailed.value = true;
    } finally {
      if (controller === current) loadingMore.value = false;
    }
  }

  watch(params, load, { immediate: true });

  return {
    params,
    setFilters: setParams,
    searchInput,
    hasFilters,
    clearFilters,
    entries,
    total,
    hasMore: computed(() => nextCursor.value !== null),
    state,
    loadingMore,
    loadMoreFailed,
    loadMore,
    reload: load,
  };
}
