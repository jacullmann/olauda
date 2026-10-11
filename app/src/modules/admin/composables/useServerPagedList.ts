import {
  onActivated,
  onDeactivated,
  ref,
  shallowRef,
  triggerRef,
  watch,
} from 'vue';
import axios from 'axios';
import api from '@/api/client';
import type { ListWindow, SortOrder } from '@/modules/admin/types';
import {
  useRouteQueryState,
  useSearchInput,
  type RouteQueryStateOptions,
} from './useRouteQueryState';

/** Rows per request; the server takes up to 100. */
export const BLOCK_SIZE = 50;

type ListParams = { search: string; sort: string; order: SortOrder } & Record<
  string,
  string
>;

export interface WindowedListOptions<
  TParams extends ListParams,
> extends RouteQueryStateOptions<TParams> {
  endpoint: string;
  /** Sorts that start ascending when first picked, such as names. */
  ascendingSorts?: readonly TParams['sort'][];
  onError: () => void;
}

export type WindowedListState = 'loading' | 'ready' | 'failed';

/**
 * A server-side searchable and sortable list, loaded block by block as its
 * rows come into view. The first block brings the total, so the list has its
 * full height from the start and any part of it can be scrolled to directly;
 * only the blocks in view are then fetched. Filters and sorting live in the
 * URL query.
 */
export function useServerPagedList<TItem, TParams extends ListParams>(
  options: WindowedListOptions<TParams>,
) {
  const { params, setParams } = useRouteQueryState(options);
  const searchInput = useSearchInput(
    () => params.value.search,
    (search) => setParams({ search } as Partial<TParams>, true),
  );

  const total = ref(0);
  const state = ref<WindowedListState>('loading');
  // Replaced or triggered as a whole: rows are never edited in place.
  const blocks = shallowRef(new Map<number, TItem[]>());
  const inFlight = new Map<number, AbortController>();
  /** The blocks last in view, which a refresh fetches again. */
  let blocksInView: number[] = [0];
  /** Bumped whenever loaded blocks may no longer fit together. */
  let generation = 0;

  const itemAt = (index: number): TItem | undefined =>
    blocks.value.get(Math.floor(index / BLOCK_SIZE))?.[index % BLOCK_SIZE];

  async function fetchBlock(block: number) {
    const controller = new AbortController();
    const startedIn = generation;
    inFlight.set(block, controller);

    try {
      const { data } = await api.get<ListWindow<TItem>>(options.endpoint, {
        params: {
          ...params.value,
          offset: block * BLOCK_SIZE,
          limit: BLOCK_SIZE,
        },
        signal: controller.signal,
      });
      if (startedIn !== generation) return;
      blocks.value.set(block, data.items);
      triggerRef(blocks);
      total.value = data.total;
      state.value = 'ready';
    } catch (error) {
      if (axios.isCancel(error) || startedIn !== generation) return;
      if (state.value === 'loading') state.value = 'failed';
      else options.onError();
    } finally {
      if (inFlight.get(block) === controller) inFlight.delete(block);
    }
  }

  function abortAll() {
    generation += 1;
    for (const controller of inFlight.values()) controller.abort();
    inFlight.clear();
  }

  /** Fetches the blocks covering rows `start` to `end` that are neither loaded nor loading. */
  function ensureRange(start: number, end: number) {
    const first = Math.floor(start / BLOCK_SIZE);
    const last = Math.floor(end / BLOCK_SIZE);
    blocksInView = Array.from(
      { length: last - first + 1 },
      (_, i) => first + i,
    );
    for (const block of blocksInView) {
      if (!blocks.value.has(block) && !inFlight.has(block)) {
        void fetchBlock(block);
      }
    }
  }

  function reset() {
    abortAll();
    blocks.value = new Map();
    total.value = 0;
    state.value = 'loading';
    blocksInView = [0];
    void fetchBlock(0);
  }

  /**
   * Fetches the rows in view again, showing the old ones until the new ones
   * arrive. Every other block is dropped: rows may have come or gone since.
   */
  function refresh() {
    if (state.value !== 'ready') return reset();
    abortAll();
    const kept = new Map<number, TItem[]>();
    for (const block of blocksInView) {
      const rows = blocks.value.get(block);
      if (rows) kept.set(block, rows);
    }
    blocks.value = kept;
    for (const block of blocksInView) void fetchBlock(block);
  }

  function toggleSort(sort: TParams['sort']) {
    if (params.value.sort === sort) {
      const order: SortOrder = params.value.order === 'asc' ? 'desc' : 'asc';
      return setParams({ order } as Partial<TParams>);
    }
    const order: SortOrder = options.ascendingSorts?.includes(sort)
      ? 'asc'
      : 'desc';
    return setParams({ sort, order } as Partial<TParams>);
  }

  watch(params, reset, { immediate: true });

  // A list kept alive behind a detail page shows what may have changed there,
  // such as an account banned or deleted, as soon as it is back.
  let wasDeactivated = false;
  onDeactivated(() => {
    wasDeactivated = true;
  });
  onActivated(() => {
    if (wasDeactivated) refresh();
  });

  return {
    params,
    setParams,
    toggleSort,
    searchInput,
    total,
    state,
    itemAt,
    ensureRange,
    refresh,
  };
}
