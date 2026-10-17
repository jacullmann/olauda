import { computed, shallowRef } from 'vue';
import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/vue-query';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
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

/** A block of the list: the rows from `offset` on, at most `limit` of them. */
export type ListBlock<TParams extends ListParams> = TParams & {
  offset: number;
  limit: number;
};

export interface ServerPagedListOptions<
  TParams extends ListParams,
  TItem,
> extends RouteQueryStateOptions<TParams> {
  // A key and a fetcher rather than ready query options: Vue Query's option
  // types cannot be resolved for a generic row type, so the list puts them
  // together itself.
  /** The key of one block, such as `adminKeys.userList`. */
  keyOf: (block: ListBlock<TParams>) => QueryKey;
  /** Loads one block, such as `fetchAdminUsers`. */
  fetchBlock: (
    block: ListBlock<TParams>,
    signal: AbortSignal,
  ) => Promise<ListWindow<TItem>>;
  /** The prefix of every block's key, which a refresh invalidates. */
  listKey: QueryKey;
  /** Sorts that start ascending when first picked, such as names. */
  ascendingSorts?: readonly TParams['sort'][];
  /** For a block other than the first that failed while the list is on screen. */
  loadErrorMessage: (error: unknown) => string;
}

export type WindowedListState = 'loading' | 'ready' | 'failed';

/**
 * A server-side searchable and sortable list, loaded block by block as its
 * rows come into view. The first block brings the total, so the list has its
 * full height from the start and any part of it can be scrolled to directly;
 * only the blocks in view are then fetched. Filters and sorting live in the
 * URL query.
 */
export function useServerPagedList<TParams extends ListParams, TItem>(
  options: ServerPagedListOptions<TParams, TItem>,
) {
  const queryClient = useQueryClient();
  const { params, setParams } = useRouteQueryState(options);
  const searchInput = useSearchInput(
    () => params.value.search,
    (search) => setParams({ search } as Partial<TParams>, true),
  );

  const blockOptions = (index: number) => {
    const block: ListBlock<TParams> = {
      ...params.value,
      offset: index * BLOCK_SIZE,
      limit: BLOCK_SIZE,
    };
    return {
      queryKey: options.keyOf(block),
      queryFn: ({ signal }: QueryFunctionContext) =>
        options.fetchBlock(block, signal),
    };
  };

  // The first block stands for the list as a whole: while another search,
  // filter or sort loads, the rows and total shown so far stay on screen.
  const first = useQuery(
    computed(() => ({
      ...blockOptions(0),
      placeholderData: keepPreviousData,
    })),
  );

  /** The blocks after the first that are in view, in order. */
  const laterBlocks = shallowRef<number[]>([]);

  // A block that leaves the view drops its query; its rows stay cached for a
  // return. The results follow the blocks a moment later, so each carries
  // its block number instead of relying on its place in the list.
  const later = useQueries({
    queries: computed(() =>
      laterBlocks.value.map((block) => ({
        ...blockOptions(block),
        select: ({ items }: ListWindow<TItem>) => ({ block, items }),
        // Rows for new params wait until the first block has them, so the
        // old rows above are never followed by new ones below.
        enabled: !first.isPlaceholderData.value,
      })),
    ),
  });

  useLoadErrorToast(
    {
      error: computed(() => later.value.find((block) => block.isError)?.error),
      isLoadingError: computed(() =>
        later.value.some((block) => block.isLoadingError),
      ),
      isSuccess: computed(() => later.value.every((block) => block.isSuccess)),
    },
    options.loadErrorMessage,
  );

  const blocks = computed(() => {
    const rows = new Map<number, ListWindow<TItem>['items']>();
    const firstRows = first.data.value?.items;
    if (firstRows) rows.set(0, firstRows);
    for (const { data } of later.value) {
      if (data) rows.set(data.block, data.items);
    }
    return rows;
  });

  const total = computed(() => first.data.value?.total ?? 0);

  const state = computed<WindowedListState>(() => {
    if (first.data.value) return 'ready';
    if (first.isError.value && !first.isFetching.value) return 'failed';
    return 'loading';
  });

  /** Whether the rows shown belong to the previous params while new ones load. */
  const updating = first.isPlaceholderData;

  const itemAt = (index: number): TItem | undefined =>
    blocks.value.get(Math.floor(index / BLOCK_SIZE))?.[index % BLOCK_SIZE];

  /** Loads the blocks covering rows `start` to `end`, retrying failed ones. */
  function ensureRange(start: number, end: number) {
    const firstBlock = Math.max(1, Math.floor(start / BLOCK_SIZE));
    const lastBlock = Math.floor(end / BLOCK_SIZE);
    const next = Array.from(
      { length: Math.max(0, lastBlock - firstBlock + 1) },
      (_, i) => firstBlock + i,
    );
    const current = laterBlocks.value;
    if (
      next.length !== current.length ||
      next.some((block, i) => block !== current[i])
    ) {
      laterBlocks.value = next;
    }
    for (const block of later.value) {
      if (block.isError && !block.isFetching) void block.refetch();
    }
  }

  /**
   * Fetches the rows in view again, showing the old ones until the new ones
   * arrive. Every other block is fetched again once it comes back into view:
   * rows may have come or gone since.
   */
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: options.listKey });
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

  return {
    params,
    setParams,
    toggleSort,
    searchInput,
    total,
    state,
    updating,
    itemAt,
    ensureRange,
    refresh,
  };
}
