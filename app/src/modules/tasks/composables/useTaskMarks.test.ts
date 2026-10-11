import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Task } from '@/modules/tasks/types';
import { useTaskMarks } from './useTaskMarks';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/api/client', () => ({ default: apiMock }));
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
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useTaskMarks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.get.mockResolvedValue({ data: { itemIds: ['task-1'] } });
  });

  it('keeps the pins already shown when reloading them fails', async () => {
    const marks = useTaskMarks('group-1', ref(true));
    await marks.load();
    expect(marks.isPinned('task-1')).toBe(true);

    apiMock.get.mockRejectedValue(new Error('offline'));
    await marks.load();

    expect(marks.isPinned('task-1')).toBe(true);
    expect(marks.pinsLoading.value).toBe(false);
  });

  it('waits for a pending pin before sending the unpin that follows it', async () => {
    const marks = useTaskMarks('group-1', ref(true));
    apiMock.get.mockResolvedValue({ data: { itemIds: [] } });
    await marks.load();

    const pin = deferred();
    apiMock.post.mockReturnValueOnce(pin.promise);
    apiMock.delete.mockResolvedValue({});

    const first = marks.togglePin(task);
    await vi.waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    const second = marks.togglePin(task);
    expect(marks.isPinned('task-1')).toBe(false);
    expect(apiMock.delete).not.toHaveBeenCalled();

    pin.resolve();
    await Promise.all([first, second]);

    expect(apiMock.delete).toHaveBeenCalledTimes(1);
    expect(marks.isPinned('task-1')).toBe(false);
  });

  it('sends nothing when two clicks cancel out before syncing', async () => {
    const marks = useTaskMarks('group-1', ref(true));
    apiMock.get.mockResolvedValue({ data: { itemIds: [] } });
    await marks.load();

    await Promise.all([marks.togglePin(task), marks.togglePin(task)]);

    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
  });

  it('reverts to the server state when a pin request fails', async () => {
    const marks = useTaskMarks('group-1', ref(true));
    apiMock.get.mockResolvedValue({ data: { itemIds: [] } });
    await marks.load();

    apiMock.post.mockRejectedValue(new Error('server error'));
    await marks.togglePin(task);

    expect(marks.isPinned('task-1')).toBe(false);
    expect(apiMock.post).toHaveBeenCalledTimes(1);
  });
});
