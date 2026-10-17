import { computed, type Ref } from 'vue';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { Task } from '@/modules/tasks/types';
import {
  taskListQuery,
  type TaskListParams,
} from '@/modules/tasks/utils/taskQueries';
import type { TaskFilters } from './useTaskFilters';

function listParams(
  { tab, showOldEntries, subject, hideChecked }: TaskFilters,
  personalized: boolean,
): TaskListParams {
  return {
    type: tab === 'all' ? undefined : tab,
    archived: showOldEntries,
    subjectId: subject || undefined,
    hideChecked,
    personalized,
  };
}

/** The group's tasks as the server lists them for the current filters. */
export function useTaskItems(
  groupId: string,
  filters: Readonly<Ref<TaskFilters>>,
  personalized: Readonly<Ref<boolean>>,
) {
  const query = useQuery(
    computed(() => ({
      ...taskListQuery(groupId, listParams(filters.value, personalized.value)),
      // The list for the previous filters stays until the new one arrives,
      // instead of the page dropping back to its skeleton.
      placeholderData: keepPreviousData,
    })),
  );

  const items = computed<Task[]>(() => query.data.value?.items ?? []);
  /** Tasks the server left out because of the member's course selection. */
  const hiddenByCourses = computed(
    () => query.data.value?.hiddenByCourses ?? 0,
  );
  const hasCurrentList = computed(
    () => query.data.value !== undefined && !query.isPlaceholderData.value,
  );
  /** No list for the current filters yet; a background refetch is not this. */
  const loading = computed(
    () => query.isFetching.value && !hasCurrentList.value,
  );
  const initialLoad = query.isPending;
  /**
   * There is no list for the filters, as loading it failed. A failed
   * background refetch keeps showing the list it had.
   */
  const loadError = computed(
    () => query.isError.value && !hasCurrentList.value,
  );

  async function reloadList(): Promise<void> {
    await query.refetch();
  }

  function findInList(taskId: string): Task | undefined {
    return items.value.find((task) => task.id === taskId);
  }

  return {
    items,
    hiddenByCourses,
    loading,
    initialLoad,
    loadError,
    /** When the list last arrived, which its copies of tasks are as fresh as. */
    updatedAt: query.dataUpdatedAt,
    reloadList,
    findInList,
  };
}
