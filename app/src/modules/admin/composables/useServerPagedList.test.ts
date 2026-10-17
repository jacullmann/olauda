import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, effectScope, reactive, type EffectScope } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { ListWindow } from '@/modules/admin/types';
import {
  BLOCK_SIZE,
  useServerPagedList,
  type ListBlock,
} from './useServerPagedList';

vi.mock('vue-router', () => ({
  useRoute: () => reactive({ name: 'list', query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/common/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn() }),
}));

type Params = { search: string; sort: string; order: 'asc' | 'desc' };

const TOTAL = 3 * BLOCK_SIZE;

/** Serves rows numbered by their index in the whole list. */
const fetchBlock = vi.fn(
  ({ offset, limit }: ListBlock<Params>): Promise<ListWindow<number>> =>
    Promise.resolve({
      items: Array.from({ length: limit }, (_, i) => offset + i),
      total: TOTAL,
    }),
);

let scope: EffectScope;

async function loadedList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const app = createApp({});
  app.use(VueQueryPlugin, { queryClient });
  scope = effectScope();
  const list = scope.run(() =>
    app.runWithContext(() =>
      useServerPagedList<Params, number>({
        keyOf: (block) => ['list', block],
        fetchBlock,
        listKey: ['list'],
        defaults: { search: '', sort: 'name', order: 'asc' },
        loadErrorMessage: () => 'failed',
      }),
    ),
  )!;
  await vi.waitFor(() => expect(list.state.value).toBe('ready'));
  return list;
}

describe('useServerPagedList', () => {
  afterEach(() => {
    scope.stop();
    fetchBlock.mockClear();
  });

  it('loads the first block with the total, then only the blocks in view', async () => {
    const list = await loadedList();

    expect(list.total.value).toBe(TOTAL);
    expect(list.itemAt(BLOCK_SIZE - 1)).toBe(BLOCK_SIZE - 1);
    expect(list.itemAt(2 * BLOCK_SIZE)).toBeUndefined();

    list.ensureRange(2 * BLOCK_SIZE + 5, 2 * BLOCK_SIZE + 10);

    await vi.waitFor(() =>
      expect(list.itemAt(2 * BLOCK_SIZE + 7)).toBe(2 * BLOCK_SIZE + 7),
    );
    expect(list.itemAt(BLOCK_SIZE)).toBeUndefined();
    expect(fetchBlock.mock.calls.map(([block]) => block.offset)).toEqual([
      0,
      2 * BLOCK_SIZE,
    ]);
  });

  it('places every block by its own number while the view moves on', async () => {
    const list = await loadedList();

    list.ensureRange(BLOCK_SIZE, 3 * BLOCK_SIZE - 1);
    await vi.waitFor(() =>
      expect(list.itemAt(3 * BLOCK_SIZE - 1)).toBe(3 * BLOCK_SIZE - 1),
    );
    list.ensureRange(2 * BLOCK_SIZE, 3 * BLOCK_SIZE - 1);

    expect(list.itemAt(2 * BLOCK_SIZE)).toBe(2 * BLOCK_SIZE);
    await vi.waitFor(() => expect(list.itemAt(BLOCK_SIZE)).toBeUndefined());
    expect(list.itemAt(2 * BLOCK_SIZE)).toBe(2 * BLOCK_SIZE);
  });
});
