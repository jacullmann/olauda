import { computed, ref, watch, type Ref } from 'vue';
import { isAxiosError } from 'axios';
import type { Task } from '@/modules/tasks/types';

export type OpenedItemError = 'not-found' | 'failed';

interface OpenedTaskOptions {
  openedItemId: Readonly<Ref<string | null>>;
  findInList: (taskId: string) => Task | undefined;
  fetchTask: (taskId: string) => Promise<Task>;
}

/**
 * The task the page shows on its own, as last seen. It outlives the list's
 * copy, since a task can be opened from a link while the list holds another
 * tab, or be dropped from the list while it stays open.
 */
export function useOpenedTask({
  openedItemId,
  findInList,
  fetchTask,
}: OpenedTaskOptions) {
  const openedItem = ref<Task | null>(null);
  const openedItemError = ref<OpenedItemError | null>(null);

  const listCopy = computed(() =>
    openedItemId.value ? findInList(openedItemId.value) : undefined,
  );

  // The list's copy is the one every action keeps up to date, so it takes over
  // whenever the list holds the task, also after a reload replaced it.
  watch(listCopy, (task) => {
    if (task) openedItem.value = task;
  });

  async function fetchOpenedItem(taskId: string) {
    try {
      const task = await fetchTask(taskId);
      if (openedItemId.value !== taskId) return;
      openedItem.value = listCopy.value ?? task;
    } catch (e) {
      if (openedItemId.value !== taskId) return;
      openedItemError.value =
        isAxiosError(e) && e.response?.status === 404 ? 'not-found' : 'failed';
    }
  }

  function loadOpenedItem() {
    const taskId = openedItemId.value;
    openedItemError.value = null;
    openedItem.value = listCopy.value ?? null;
    // Opened from a link, the task is fetched alongside the list rather than
    // after it, and may not be part of it at all.
    if (taskId && !listCopy.value) void fetchOpenedItem(taskId);
  }

  watch(openedItemId, loadOpenedItem, { immediate: true });

  /** Takes over a fresher copy of the opened task. */
  function replaceOpenedItem(task: Task) {
    if (openedItem.value?.id === task.id) openedItem.value = task;
  }

  return {
    openedItem,
    openedItemError,
    isOpenedOutsideList: computed(
      () => !!openedItemId.value && !listCopy.value,
    ),
    retryOpenedItem: loadOpenedItem,
    replaceOpenedItem,
  };
}
