import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, effectScope, ref, type EffectScope } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Task } from '@/modules/tasks/types';
import { useTaskMarks } from './useTaskMarks';

const apiMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  DELETE: vi.fn(),
}));

// The mocked requests resolve to their data right away, as `unwrap` would.
vi.mock('@/api/client', () => ({
  default: apiMock,
  unwrap: (pending: Promise<unknown>) => pending,
}));
vi.stubGlobal('document', new EventTarget());
vi.mock('@/modules/account/composables/usePageSettings', () => ({
  usePageSettings: () => ({
    settings: ref({
      archiveChecked: 'never',
      archiveOtherCoursesPastDue: false,
    }),
  }),
}));

const task = { id: 'task-1' } as Task;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

/** Answers the reads of the member's marks with `pinned` as their pins. */
function serveMarks(pinned: string[]) {
  apiMock.GET.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/user/visibility'
        ? { archived: [], kept: [] }
        : { itemIds: path === '/user/pins' ? pinned : [] },
    ),
  );
}

let scope: EffectScope;
let queryClient: QueryClient;

async function loadedMarks() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const app = createApp({});
  app.use(VueQueryPlugin, { queryClient });
  scope = effectScope();
  const marks = scope.run(() =>
    app.runWithContext(() => useTaskMarks('group-1', ref(true))),
  )!;
  await vi.waitFor(() => expect(marks.loading.value).toBe(false));
  return marks;
}

describe('useTaskMarks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serveMarks(['task-1']);
  });

  afterEach(() => {
    scope.stop();
    queryClient.clear();
  });

  it('keeps the pins already shown when reloading them fails', async () => {
    const marks = await loadedMarks();
    expect(marks.isPinned('task-1')).toBe(true);

    apiMock.GET.mockRejectedValue(new Error('offline'));
    await queryClient.refetchQueries();

    expect(marks.isPinned('task-1')).toBe(true);
    expect(marks.loading.value).toBe(false);
  });

  it('waits for a pending pin before sending the unpin that follows it', async () => {
    serveMarks([]);
    const marks = await loadedMarks();

    const pin = deferred();
    apiMock.POST.mockReturnValueOnce(pin.promise);
    apiMock.DELETE.mockResolvedValue(undefined);

    const first = marks.togglePin(task);
    await vi.waitFor(() => expect(apiMock.POST).toHaveBeenCalledTimes(1));
    const second = marks.togglePin(task);
    expect(marks.isPinned('task-1')).toBe(false);
    expect(apiMock.DELETE).not.toHaveBeenCalled();

    pin.resolve();
    await Promise.all([first, second]);

    expect(apiMock.DELETE).toHaveBeenCalledTimes(1);
    expect(marks.isPinned('task-1')).toBe(false);
  });

  it('sends nothing when two clicks cancel out before syncing', async () => {
    serveMarks([]);
    const marks = await loadedMarks();

    await Promise.all([marks.togglePin(task), marks.togglePin(task)]);

    expect(apiMock.POST).not.toHaveBeenCalled();
    expect(apiMock.DELETE).not.toHaveBeenCalled();
  });

  it('reverts to the server state when a pin request fails', async () => {
    serveMarks([]);
    const marks = await loadedMarks();
    const reverted = vi.fn();
    marks.onPinReverted(reverted);

    apiMock.POST.mockRejectedValue(new Error('server error'));
    await marks.togglePin(task);

    expect(marks.isPinned('task-1')).toBe(false);
    expect(apiMock.POST).toHaveBeenCalledTimes(1);
    expect(reverted).toHaveBeenCalledWith(task);
  });

  it('keeps a confirmed pin although a refetch from before it lands later', async () => {
    serveMarks([]);
    const marks = await loadedMarks();

    const stalePins = deferred();
    apiMock.GET.mockImplementation(async (path: string) => {
      if (path !== '/user/pins') return { archived: [], kept: [], itemIds: [] };
      await stalePins.promise;
      return { itemIds: [] };
    });
    const refetch = queryClient.refetchQueries();
    apiMock.POST.mockResolvedValue(undefined);

    await marks.togglePin(task);
    stalePins.resolve();
    await refetch;

    expect(marks.isPinned('task-1')).toBe(true);
  });
});
