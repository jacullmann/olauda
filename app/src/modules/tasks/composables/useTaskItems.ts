import { ref, type Ref } from 'vue';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { hiddenByCourses as countHiddenByCourses } from '@/modules/courses/utils/personalization';
import type { Task } from '@/modules/tasks/types';
import type { TaskFilters } from './useTaskFilters';

/** The group's tasks as the server lists them for the current filters. */
export function useTaskItems(
  groupId: string,
  filters: Readonly<Ref<TaskFilters>>,
  personalized: Readonly<Ref<boolean>>,
) {
  const items = ref<Task[]>([]);
  /** Tasks the server left out because of the member's course selection. */
  const hiddenByCourses = ref(0);
  const loading = ref(true);
  const initialLoad = ref(true);
  /** The last load failed, so the list shown is not the one for the filters. */
  const loadError = ref(false);
  let latestReload = 0;

  // Reloads overlap as filters change in quick succession, and an earlier one
  // answering last would show the list for filters no longer chosen.
  async function reloadList() {
    const reload = ++latestReload;
    loading.value = true;
    const { tab, showOldEntries, subject, hideChecked } = filters.value;
    const params: Record<string, string | boolean> = { type: tab };
    if (showOldEntries) params.filter = 'old';
    if (subject) params.subjectId = subject;
    if (hideChecked) params.hideChecked = true;
    if (personalized.value) params.personalized = true;

    try {
      const response = await api.get<Task[]>(groupPath(groupId, '/items'), {
        params,
      });
      if (reload !== latestReload) return;
      items.value = response.data;
      hiddenByCourses.value = countHiddenByCourses(response);
      loadError.value = false;
    } catch (e) {
      if (reload !== latestReload) return;
      console.error('Failed to load items:', e);
      loadError.value = true;
    } finally {
      if (reload === latestReload) {
        loading.value = false;
        initialLoad.value = false;
      }
    }
  }

  async function fetchTask(taskId: string): Promise<Task> {
    const { data } = await api.get<Task>(
      groupPath(groupId, `/items/${taskId}`),
    );
    return data;
  }

  function findInList(taskId: string): Task | undefined {
    return items.value.find((task) => task.id === taskId);
  }

  /** Replaces the list's copy of a task, if it holds one. */
  function replaceInList(task: Task) {
    const index = items.value.findIndex(({ id }) => id === task.id);
    if (index !== -1) items.value[index] = task;
  }

  function removeFromList(taskId: string) {
    items.value = items.value.filter(({ id }) => id !== taskId);
  }

  return {
    items,
    hiddenByCourses,
    loading,
    initialLoad,
    loadError,
    reloadList,
    fetchTask,
    findInList,
    replaceInList,
    removeFromList,
  };
}
