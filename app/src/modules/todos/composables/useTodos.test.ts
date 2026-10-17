import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApp,
  effectScope,
  reactive,
  toRefs,
  type EffectScope,
} from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Todo } from '@/modules/todos/types';
import { useTodos } from './useTodos';

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  DELETE: vi.fn(),
}));

// The mocked requests resolve to their data right away, as `unwrap` would.
vi.mock('@/api/client', () => ({
  default: apiMock,
  unwrap: (pending: Promise<unknown>) => pending,
}));
vi.mock('@/api/errors', () => ({
  apiErrorMessage: (_: unknown, fallback: string) => fallback,
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/common/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn() }),
}));
vi.mock('@/modules/account/stores/useUserStore', () => ({
  useUserStore: () => reactive({ user: { id: 'user-1' } }),
}));
vi.mock('pinia', () => ({ storeToRefs: toRefs }));
vi.mock('@/shell/stores/useConfirmModal', () => ({
  useConfirmModal: () => ({ ask: vi.fn() }),
}));
vi.stubGlobal(
  'document',
  Object.assign(new EventTarget(), { visibilityState: 'visible' }),
);

const todo = (id: string, position: string): Todo => ({
  id,
  position,
  title: id,
  description: '',
  completed: false,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

let scope: EffectScope;
let queryClient: QueryClient;

async function loadedTodos() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const app = createApp({});
  app.use(VueQueryPlugin, { queryClient });
  scope = effectScope();
  const todos = scope.run(() => app.runWithContext(() => useTodos()))!;
  await vi.waitFor(() => expect(todos.loading.value).toBe(false));
  return todos;
}

const shownIds = (todos: Awaited<ReturnType<typeof loadedTodos>>) =>
  todos.displayPrivateTasks.value.map(({ id }) => id);

describe('useTodos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.GET.mockResolvedValue([
      todo('a', '10'),
      todo('b', '20'),
      todo('c', '30'),
    ]);
  });

  afterEach(() => {
    scope.stop();
    queryClient.clear();
  });

  it('sends moves one after another, naming the todo each lands below', async () => {
    const todos = await loadedTodos();
    const firstMove = deferred<unknown>();
    apiMock.PUT.mockReturnValueOnce(firstMove.promise).mockResolvedValueOnce({
      id: 'a',
      position: '28',
      updatedAt: '2026-10-02T00:00:00Z',
    });

    todos.reorderPrivateTask(2, 0);
    todos.reorderPrivateTask(1, 2);

    expect(shownIds(todos)).toEqual(['c', 'b', 'a']);
    await vi.waitFor(() => expect(apiMock.PUT).toHaveBeenCalledTimes(1));
    expect(apiMock.PUT.mock.calls[0]![1]).toMatchObject({
      params: { path: { id: 'c' } },
      body: { afterId: null },
    });

    firstMove.resolve({
      id: 'c',
      position: '08',
      updatedAt: '2026-10-02T00:00:00Z',
    });
    await vi.waitFor(() => expect(apiMock.PUT).toHaveBeenCalledTimes(2));
    expect(apiMock.PUT.mock.calls[1]![1]).toMatchObject({
      params: { path: { id: 'a' } },
      body: { afterId: 'b' },
    });

    await vi.waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(shownIds(todos)).toEqual(['c', 'b', 'a']);
    expect(
      queryClient.getQueryData<Todo[]>(['todos'])!.map((t) => t.position),
    ).toEqual(['28', '20', '08']);
  });

  it('keeps a completion the server confirmed', async () => {
    vi.useFakeTimers();
    const todos = await loadedTodos();
    apiMock.PUT.mockResolvedValue({
      id: 'a',
      completed: true,
      updatedAt: '2026-10-02T00:00:00Z',
    });

    todos.togglePrivateTaskCompletion(todo('a', '10'));
    expect(todos.displayPrivateTasks.value[0]!.completed).toBe(true);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(apiMock.PUT).toHaveBeenCalledExactlyOnceWith(
      '/todos/{id}/completed',
      { params: { path: { id: 'a' } }, body: { completed: true } },
    );
    expect(
      queryClient.getQueryData<Todo[]>(['todos'])!.find((t) => t.id === 'a')!
        .completed,
    ).toBe(true);
  });
});
