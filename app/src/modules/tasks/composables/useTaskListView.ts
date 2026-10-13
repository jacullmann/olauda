import { computed, type Ref } from 'vue';
import type { Task } from '@/modules/tasks/types';

interface ListViewOptions {
  items: Readonly<Ref<Task[]>>;
  hideChecked: Readonly<Ref<boolean>>;
  isChecked: (id: string) => boolean;
  isPinned: (id: string) => boolean;
  pendingCheckRemovals: ReadonlySet<string>;
}

/** The loaded tasks in the order the list shows them, pinned ones first. */
export function useTaskListView({
  items,
  hideChecked,
  isChecked,
  isPinned,
  pendingCheckRemovals,
}: ListViewOptions) {
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

  return { filteredItems };
}
