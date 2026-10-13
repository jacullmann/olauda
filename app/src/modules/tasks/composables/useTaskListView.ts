import { computed, ref, type Ref } from 'vue';
import type { Task } from '@/modules/tasks/types';

/** Tasks shown at first, and added each time the list is scrolled to its end. */
export const TASK_PAGE_SIZE = 10;

interface ListViewOptions {
  items: Readonly<Ref<Task[]>>;
  hideChecked: Readonly<Ref<boolean>>;
  isChecked: (id: string) => boolean;
  isPinned: (id: string) => boolean;
  pendingCheckRemovals: ReadonlySet<string>;
}

/** The loaded tasks in the order the list shows them, a page at a time. */
export function useTaskListView({
  items,
  hideChecked,
  isChecked,
  isPinned,
  pendingCheckRemovals,
}: ListViewOptions) {
  const visibleCount = ref(TASK_PAGE_SIZE);

  const filteredItems = computed(() => {
    const pinnedTasks: Task[] = [];
    const otherTasks: Task[] = [];
    for (const task of items.value) {
      const hidden =
        hideChecked.value &&
        isChecked(task.id) &&
        !pendingCheckRemovals.has(task.id);
      if (hidden) continue;
      (isPinned(task.id) ? pinnedTasks : otherTasks).push(task);
    }
    return [...pinnedTasks, ...otherTasks];
  });

  const limitedItems = computed(() =>
    filteredItems.value.slice(0, visibleCount.value),
  );

  const hasMoreItems = computed(
    () => visibleCount.value < filteredItems.value.length,
  );

  function resetVisibleCount() {
    visibleCount.value = TASK_PAGE_SIZE;
  }

  /** Shows the next page and returns the tasks it brought into view. */
  function showMore(): Task[] {
    const previousCount = visibleCount.value;
    visibleCount.value = Math.min(
      previousCount + TASK_PAGE_SIZE,
      filteredItems.value.length,
    );
    return filteredItems.value.slice(previousCount, visibleCount.value);
  }

  return {
    visibleCount,
    filteredItems,
    limitedItems,
    hasMoreItems,
    resetVisibleCount,
    showMore,
  };
}
