import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiErrorStatus } from '@/api/errors';
import type { Task } from '@/modules/tasks/types';
import { taskQuery } from '@/modules/tasks/utils/taskQueries';

export type OpenedItemError = 'not-found' | 'failed';

const NOT_FOUND = 404;

interface OpenedTaskOptions {
  groupId: string;
  openedItemId: Readonly<Ref<string | null>>;
  findInList: (taskId: string) => Task | undefined;
  /** When the list last arrived, which its copy of the task is as fresh as. */
  listUpdatedAt: Readonly<Ref<number>>;
}

/**
 * The task the page shows on its own, as last seen. It outlives the list's
 * copy, since a task can be opened from a link while the list holds another
 * tab, or be dropped from the list while it stays open.
 */
export function useOpenedTask({
  groupId,
  openedItemId,
  findInList,
  listUpdatedAt,
}: OpenedTaskOptions) {
  const listCopy = computed(() =>
    openedItemId.value ? findInList(openedItemId.value) : undefined,
  );

  // Opened from the list, the list's copy stands in for a request of its
  // own. Opened from a link, the task is fetched alongside the list rather
  // than after it, and may not be part of it at all.
  const query = useQuery(
    computed(() => ({
      ...taskQuery(groupId, openedItemId.value ?? ''),
      enabled: !!openedItemId.value,
      initialData: () => listCopy.value,
      initialDataUpdatedAt: () => listUpdatedAt.value,
    })),
  );

  // Someone else may have deleted the task while it was open: once its
  // reload finds it gone, the copy seen before must not stay on screen.
  const isGone = computed(
    () => !listCopy.value && apiErrorStatus(query.error.value) === NOT_FOUND,
  );

  // The list's copy is the freshest whenever the list holds the task, also
  // after a reload replaced it.
  const openedItem = computed<Task | null>(() =>
    isGone.value ? null : (listCopy.value ?? query.data.value ?? null),
  );

  const openedItemError = computed<OpenedItemError | null>(() => {
    if (query.isFetching.value) return null;
    if (isGone.value) return 'not-found';
    return !openedItem.value && query.isError.value ? 'failed' : null;
  });

  async function retryOpenedItem(): Promise<void> {
    await query.refetch();
  }

  return { openedItem, openedItemError, retryOpenedItem };
}
