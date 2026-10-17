import {
  computed,
  effectScope,
  onScopeDispose,
  shallowReactive,
  shallowRef,
  watch,
  type EffectScope,
} from 'vue';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
  type QueryOptions,
  type UseQueryReturnType,
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
  TKey extends QueryKey,
> extends RouteQueryStateOptions<TParams> {
  /** The query for one block, such as `adminUsersQuery`. */
  query: (
    block: ListBlock<TParams>,
  ) => Pick<
    QueryOptions<
      ListWindow<TItem>,
      Error,
      ListWindow<TItem>,
      ListWindow<TItem>,
      TKey
    >,
    'queryKey' | 'queryFn'
  >;
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
export function useServerPagedList<
  TParams extends ListParams,
  TItem,
  TKey extends QueryKey,
>(options: ServerPagedListOptions<TParams, TItem, TKey>) {
  const queryClient = useQueryClient();
  const { params, setParams } = useRouteQueryState(options);
  const searchInput = useSearchInput(
    () => params.value.search,
    (search) => setParams({ search } as Partial<TParams>, true),
  );

  const blockOptions = (block: number) =>
    options.query({
      ...params.value,
      offset: block * BLOCK_SIZE,
      limit: BLOCK_SIZE,
    });

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

  // A query per block in view, each in a scope of its own that is stopped
  // once the block leaves the view; its rows stay cached for a return.
  const later = shallowReactive(
    new Map<
      number,
      {
        query: UseQueryReturnType<ListWindow<TItem>, Error>;
        scope: EffectScope;
      }
    >(),
  );

  watch(laterBlocks, (inView) => {
    for (const [block, entry] of later) {
      if (inView.includes(block)) continue;
      entry.scope.stop();
      later.delete(block);
    }
    for (const block of inView) {
      if (later.has(block)) continue;
      const scope = effectScope();
      const query = scope.run(() => {
        const blockQuery = useQuery(
          computed(() => ({
            ...blockOptions(block),
            // Rows for new params wait until the first block has them, so
            // the old rows above are never followed by new ones below.
            enabled: !first.isPlaceholderData.value,
          })),
          queryClient,
        );
        useLoadErrorToast(blockQuery, options.loadErrorMessage);
        return blockQuery;
      });
      if (query) later.set(block, { query, scope });
    }
  });

  onScopeDispose(() => {
    for (const entry of later.values()) entry.scope.stop();
    later.clear();
  });

  const blocks = computed(() => {
    const rows = new Map<number, ListWindow<TItem>['items']>();
    const firstRows = first.data.value?.items;
    if (firstRows) rows.set(0, firstRows);
    for (const [block, { query }] of later) {
      const blockRows = query.data.value?.items;
      if (blockRows) rows.set(block, blockRows);
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
    for (const block of next) {
      const query = later.get(block)?.query;
      if (query?.isError.value && !query.isFetching.value) {
        void query.refetch();
      }
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
