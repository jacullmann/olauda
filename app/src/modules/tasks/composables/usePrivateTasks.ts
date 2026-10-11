import { ref, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/userStore';
import api from '@/api/api.ts';
import { useConfirmModal } from '@/stores/modalStore';
import { useI18n } from 'vue-i18n';
import type { PrivateTask } from '@/modules/tasks/types';
import { useToast } from '@/common/composables/useToast';
import { apiErrorMessage } from '@/api/errors';

/**
 * A key that sorts strictly between two positions, so a moved task lands in
 * its slot straight away instead of wherever a guessed key happens to sort
 * until the server answers with the real one. Appending a character, as the
 * obvious shortcut, sorts after the key it extends and can overshoot the
 * neighbour on the other side.
 */
function positionBetween(prev: string | null, next: string | null): string {
  const lower = prev ?? '';
  let upper = next;
  let key = '';

  for (let i = 0; i < lower.length + (upper?.length ?? 0) + 1; i++) {
    const lo = i < lower.length ? lower.charCodeAt(i) : 0;
    const hi =
      upper !== null && i < upper.length ? upper.charCodeAt(i) : 0x10000;

    if (lo === hi) {
      key += String.fromCharCode(lo);
      continue;
    }

    const mid = (lo + hi) >> 1;
    if (mid > lo) return key + String.fromCharCode(mid);

    // Adjacent characters leave no room here; anything after `lower` at this
    // depth already sorts below `upper`.
    key += String.fromCharCode(lo);
    upper = null;
  }

  return key;
}

export function usePrivateTasks() {
  const { t } = useI18n();
  const userStore = useUserStore();
  const confirmModal = useConfirmModal();
  const { user } = storeToRefs(userStore);

  const privateTasks = ref<PrivateTask[]>([]);
  const displayPrivateTasks = ref<PrivateTask[]>([]);
  const loading = ref(false);
  // Later loads (a duplicate, a failed reorder) refresh the list in place.
  const initialLoad = ref(true);
  const openMenuId = ref<string | null>(null);

  const sortDisplayList = (data: PrivateTask[]) =>
    [...data].sort((a, b) => {
      const posA = a.position || null;
      const posB = b.position || null;
      if (posA && posB) return posA < posB ? -1 : posA > posB ? 1 : 0;
      if (posA && !posB) return -1;
      if (!posA && posB) return 1;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const syncState = () => {
    displayPrivateTasks.value = sortDisplayList(privateTasks.value);
  };

  const addPrivateTask = (task: PrivateTask) => {
    privateTasks.value.unshift(task);
    syncState();
  };

  const updatePrivateTask = (task: PrivateTask) => {
    const idx = privateTasks.value.findIndex((t) => t.id === task.id);
    if (idx !== -1) {
      const current = privateTasks.value[idx];
      if (current) {
        privateTasks.value[idx] = { ...current, ...task };
        syncState();
      }
    }
  };

  const toggleMenu = (id: string) => {
    openMenuId.value = openMenuId.value === id ? null : id;
  };

  const closeMenu = () => {
    openMenuId.value = null;
  };

  useEventListener(document, 'click', closeMenu);

  const loadPrivateTasks = async () => {
    if (!user.value) return;
    loading.value = true;
    try {
      const { data } = await api.get('/todos');
      privateTasks.value = data;
      syncState();
    } catch {
      useToast().error(t('tasks.private_tasks.errors.load'));
    } finally {
      loading.value = false;
      initialLoad.value = false;
    }
  };

  // The checkbox flips instantly; the API call is debounced per task so rapid
  // toggles collapse into at most one request. The endpoint flips the stored
  // value instead of setting it, so requests for one task must never overlap.
  const TOGGLE_SYNC_DELAY = 400;

  interface ToggleSyncEntry {
    serverCompleted: boolean;
    updatedAt?: string;
    timer?: number;
    inFlight: boolean;
  }

  const toggleSync = new Map<string, ToggleSyncEntry>();

  const findPrivateTask = (id: string) =>
    privateTasks.value.find((t) => t.id === id);

  const togglePrivateTaskCompletion = (task: PrivateTask) => {
    const current = findPrivateTask(task.id) ?? task;
    let entry = toggleSync.get(current.id);
    if (!entry) {
      entry = { serverCompleted: current.completed, inFlight: false };
      toggleSync.set(current.id, entry);
    }
    current.completed = !current.completed;

    clearTimeout(entry.timer);
    entry.timer = window.setTimeout(
      () => void flushToggleSync(current.id),
      TOGGLE_SYNC_DELAY,
    );
  };

  const flushToggleSync = async (id: string): Promise<void> => {
    const entry = toggleSync.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.timer = undefined;
    // The running request re-checks the desired state when it finishes
    if (entry.inFlight) return;

    const task = findPrivateTask(id);
    if (!task || task.completed === entry.serverCompleted) {
      toggleSync.delete(id);
      return;
    }

    entry.inFlight = true;
    let error: unknown = null;
    try {
      const { data } = await api.patch(`/todos/${id}/toggle`);
      entry.serverCompleted = data.completed;
      entry.updatedAt = data.updatedAt;
    } catch (e) {
      error = e ?? new Error();
    } finally {
      entry.inFlight = false;
    }

    // User toggled again during the request; the new timer takes over
    if (entry.timer !== undefined) return;

    const current = findPrivateTask(id);
    if (!current) {
      toggleSync.delete(id);
      return;
    }

    if (error) {
      toggleSync.delete(id);
      current.completed = entry.serverCompleted;
      useToast().error(apiErrorMessage(error, t('tasks.errors.save_status')));
    } else if (current.completed !== entry.serverCompleted) {
      await flushToggleSync(id);
    } else {
      toggleSync.delete(id);
      updatePrivateTask({
        ...current,
        updatedAt: entry.updatedAt ?? current.updatedAt,
      });
    }
  };

  // Send pending syncs right away when the page is hidden (tab switch/close)
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    for (const [id, entry] of toggleSync) {
      if (entry.timer !== undefined) void flushToggleSync(id);
    }
    if (reorderTimer !== undefined) void flushReorders();
  });

  const duplicatePrivateTask = async (task: PrivateTask) => {
    loading.value = true;
    try {
      const { data } = await api.post('/todos', {
        title: task.title,
        description: task.description,
        completed: false,
      });
      addPrivateTask(data);
    } catch (e: any) {
      useToast().error(
        apiErrorMessage(e, t('tasks.private_tasks.errors.duplicate')),
      );
    } finally {
      loading.value = false;
    }
  };

  const confirmDeletePrivateTask = () =>
    confirmModal.ask({
      title: t('tasks.list.tasks.menu.delete.title'),
      content: t('tasks.private_tasks.delete_confirm'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });

  const deletePrivateTask = async (id: string, { confirm = true } = {}) => {
    if (confirm && !(await confirmDeletePrivateTask())) return;

    const idx = privateTasks.value.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const backup = privateTasks.value[idx];
    if (!backup) return;

    privateTasks.value.splice(idx, 1);
    syncState();

    try {
      await api.delete(`/todos/${id}`);
    } catch (e: any) {
      privateTasks.value.splice(idx, 0, backup);
      syncState();
      useToast().error(apiErrorMessage(e, t('tasks.errors.delete')));
    }
  };

  // A drop reorders the list instantly; the API calls wait until the user
  // stops rearranging, then go out one at a time. Each request names its
  // neighbours by server-issued keys only: the keys guessed locally for moved
  // tasks are not in the server's format and would be rejected. The server
  // keys are applied once the whole batch is through, so the list never
  // re-sorts halfway through against a mix of guessed and real keys.
  const REORDER_SYNC_DELAY = 1000;

  // Ids waiting to be sent, in the order they were first moved
  const reorderQueue = new Set<string>();
  const reorderConfirmed = new Map<
    string,
    { position: string; updatedAt: string }
  >();
  let reorderTimer: number | undefined;
  let reorderInFlight: string | null = null;

  const reorderPrivateTask = (
    id: string,
    prevPosition: string | null,
    nextPosition: string | null,
  ) => {
    const task = findPrivateTask(id);
    if (!task) return;

    if (prevPosition || nextPosition) {
      task.position = positionBetween(prevPosition, nextPosition);
    }

    syncState();

    reorderQueue.add(id);
    clearTimeout(reorderTimer);
    reorderTimer = window.setTimeout(
      () => void flushReorders(),
      REORDER_SYNC_DELAY,
    );
  };

  const isReorderPending = (id: string) =>
    reorderQueue.has(id) || reorderInFlight === id;

  // Nearest task in `step` direction whose server key is known
  const confirmedNeighbourPosition = (index: number, step: 1 | -1) => {
    const list = displayPrivateTasks.value;
    for (let i = index + step; i >= 0 && i < list.length; i += step) {
      const task = list[i];
      if (!task || isReorderPending(task.id)) continue;
      return reorderConfirmed.get(task.id)?.position ?? (task.position || null);
    }
    return null;
  };

  const flushReorders = async () => {
    clearTimeout(reorderTimer);
    reorderTimer = undefined;
    if (reorderInFlight) return;

    try {
      // A new drop restarts the timer and pauses the batch until it fires
      while (reorderTimer === undefined) {
        const id = reorderQueue.values().next().value;
        if (id === undefined) break;
        reorderQueue.delete(id);

        const index = displayPrivateTasks.value.findIndex((t) => t.id === id);
        if (index === -1) continue;

        reorderInFlight = id;
        const { data } = await api.patch(`/todos/${id}/reorder`, {
          prevPosition: confirmedNeighbourPosition(index, -1),
          nextPosition: confirmedNeighbourPosition(index, 1),
        });
        reorderInFlight = null;
        reorderConfirmed.set(id, {
          position: data.position,
          updatedAt: data.updatedAt,
        });
      }
    } catch (e) {
      reorderInFlight = null;
      reorderQueue.clear();
      reorderConfirmed.clear();
      clearTimeout(reorderTimer);
      reorderTimer = undefined;
      void loadPrivateTasks();
      useToast().error(
        apiErrorMessage(e, t('tasks.private_tasks.errors.reorder')),
      );
      return;
    }

    if (reorderQueue.size || reorderTimer !== undefined) return;

    for (const [id, confirmed] of reorderConfirmed) {
      const task = findPrivateTask(id);
      if (!task) continue;
      task.position = confirmed.position;
      task.updatedAt = confirmed.updatedAt;
    }
    reorderConfirmed.clear();
    syncState();
  };

  watch(
    () => user.value?.id,
    (id) => {
      if (id) {
        void loadPrivateTasks();
      } else {
        privateTasks.value = [];
        syncState();
      }
    },
    { immediate: true },
  );

  return {
    user,
    privateTasks,
    displayPrivateTasks,
    loading,
    initialLoad,
    openMenuId,
    loadPrivateTasks,
    addPrivateTask,
    updatePrivateTask,
    toggleMenu,
    togglePrivateTaskCompletion,
    duplicatePrivateTask,
    confirmDeletePrivateTask,
    deletePrivateTask,
    reorderPrivateTask,
  };
}
