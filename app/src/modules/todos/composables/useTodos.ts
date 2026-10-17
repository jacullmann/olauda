import { computed, reactive, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useMutation, useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { queryClient } from '@/api/queryClient';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useToast } from '@/common/composables/useToast';
import i18n from '@/i18n';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { Todo } from '@/modules/todos/types';
import { positionBetween, sortTodos } from '@/modules/todos/utils/todoOrder';
import { todoKeys, todosQuery } from '@/modules/todos/utils/todoQueries';

// The checkbox flips instantly; the API call is debounced per task so rapid
// toggles collapse into at most one request. The endpoint flips the stored
// value instead of setting it, so requests for one task must never overlap.
const TOGGLE_SYNC_DELAY = 400;

// A drop reorders the list instantly; the API calls wait until the user
// stops rearranging, then go out one at a time. Each request names its
// neighbours by server-issued keys only: the keys guessed locally for moved
// tasks are not in the server's format and would be rejected. The server
// keys are applied once the whole batch is through, so the list never
// re-sorts halfway through against a mix of guessed and real keys.
const REORDER_SYNC_DELAY = 1000;

/*
 * What the user changed but the server has yet to confirm lays over the
 * cached list instead of being written into it, so a refetch meanwhile
 * cannot undo it. It lives as long as the app, like the cache: a batch that
 * is still sending when the page is left completes all the same.
 */
const pending = {
  completed: reactive(new Map<string, boolean>()),
  positions: reactive(new Map<string, string>()),
  removed: reactive(new Set<string>()),
};

const toggleTimers = new Map<string, number>();
const togglesInFlight = new Set<string>();

// Ids waiting to be sent, in the order they were first moved
const reorderQueue = new Set<string>();
const reorderConfirmed = new Map<
  string,
  { position: string; updatedAt: string }
>();
let reorderInFlight: string | null = null;
let reorderTimer: number | undefined;

const t = (key: string) => i18n.global.t(key);
const toast = useToast();

const cachedTodos = () => queryClient.getQueryData<Todo[]>(todoKeys.all) ?? [];

const findCachedTodo = (id: string) =>
  cachedTodos().find((todo) => todo.id === id);

/** Mirrors what the server confirmed it now holds. */
const patchCachedTodo = (id: string, change: Partial<Todo>) =>
  queryClient.setQueryData<Todo[]>(todoKeys.all, (todos) =>
    todos?.map((todo) => (todo.id === id ? { ...todo, ...change } : todo)),
  );

const withPending = (todo: Todo): Todo => ({
  ...todo,
  completed: pending.completed.get(todo.id) ?? todo.completed,
  position: pending.positions.get(todo.id) ?? todo.position,
});

/** The list as the user arranged it, pending changes included. */
const arrangeTodos = (todos: readonly Todo[]): Todo[] =>
  sortTodos(
    todos.filter((todo) => !pending.removed.has(todo.id)).map(withPending),
  );

function scheduleToggleSync(id: string) {
  clearTimeout(toggleTimers.get(id));
  toggleTimers.set(
    id,
    window.setTimeout(() => void flushToggleSync(id), TOGGLE_SYNC_DELAY),
  );
}

async function flushToggleSync(id: string): Promise<void> {
  clearTimeout(toggleTimers.get(id));
  toggleTimers.delete(id);
  // The running request re-checks the desired state when it finishes
  if (togglesInFlight.has(id)) return;

  const desired = pending.completed.get(id);
  const stored = findCachedTodo(id);
  if (desired === undefined || !stored || stored.completed === desired) {
    pending.completed.delete(id);
    return;
  }

  togglesInFlight.add(id);
  try {
    const toggled = await unwrap(
      api.PATCH('/todos/{id}/toggle', { params: { path: { id } } }),
    );
    patchCachedTodo(id, {
      completed: toggled.completed,
      updatedAt: toggled.updatedAt,
    });
  } catch (error) {
    pending.completed.delete(id);
    toast.error(apiErrorMessage(error, t('tasks.errors.save_status')));
    return;
  } finally {
    togglesInFlight.delete(id);
  }

  // User toggled again during the request; the new timer takes over
  if (toggleTimers.has(id)) return;
  await flushToggleSync(id);
}

function scheduleReorderSync() {
  clearTimeout(reorderTimer);
  reorderTimer = window.setTimeout(
    () => void flushReorders(),
    REORDER_SYNC_DELAY,
  );
}

const isReorderPending = (id: string) =>
  reorderQueue.has(id) || reorderInFlight === id;

// Nearest task in `step` direction whose server key is known
function confirmedNeighbourPosition(index: number, step: 1 | -1) {
  const list = arrangeTodos(cachedTodos());
  for (let i = index + step; i >= 0 && i < list.length; i += step) {
    const task = list[i];
    if (!task || isReorderPending(task.id)) continue;
    return reorderConfirmed.get(task.id)?.position ?? (task.position || null);
  }
  return null;
}

function endReorderBatch() {
  reorderQueue.clear();
  reorderConfirmed.clear();
  pending.positions.clear();
}

async function flushReorders(): Promise<void> {
  clearTimeout(reorderTimer);
  reorderTimer = undefined;
  if (reorderInFlight) return;

  try {
    // A new drop restarts the timer and pauses the batch until it fires
    while (reorderTimer === undefined) {
      const id = reorderQueue.values().next().value;
      if (id === undefined) break;
      reorderQueue.delete(id);

      const index = arrangeTodos(cachedTodos()).findIndex(
        (todo) => todo.id === id,
      );
      if (index === -1) continue;

      reorderInFlight = id;
      const moved = await unwrap(
        api.PATCH('/todos/{id}/reorder', {
          params: { path: { id } },
          body: {
            prevPosition: confirmedNeighbourPosition(index, -1),
            nextPosition: confirmedNeighbourPosition(index, 1),
          },
        }),
      );
      reorderInFlight = null;
      reorderConfirmed.set(id, {
        position: moved.position,
        updatedAt: moved.updatedAt,
      });
    }
  } catch (error) {
    reorderInFlight = null;
    clearTimeout(reorderTimer);
    reorderTimer = undefined;
    endReorderBatch();
    // Some moves of the batch may have gone through; the server's order wins.
    void queryClient.invalidateQueries({ queryKey: todoKeys.all });
    toast.error(
      apiErrorMessage(error, t('tasks.private_tasks.errors.reorder')),
    );
    return;
  }

  if (reorderQueue.size || reorderTimer !== undefined) return;

  queryClient.setQueryData<Todo[]>(todoKeys.all, (todos) =>
    todos?.map((todo) => {
      const confirmed = reorderConfirmed.get(todo.id);
      return confirmed ? { ...todo, ...confirmed } : todo;
    }),
  );
  endReorderBatch();
}

/** Sends what is still waiting right away, as the tab may close next. */
function flushPendingSyncs() {
  for (const id of toggleTimers.keys()) void flushToggleSync(id);
  if (reorderTimer !== undefined) void flushReorders();
}

let flushOnHideInstalled = false;

function installFlushOnHideOnce() {
  if (flushOnHideInstalled) return;
  flushOnHideInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingSyncs();
  });
}

export function useTodos() {
  const { t } = useI18n();
  const confirmModal = useConfirmModal();
  const { user } = storeToRefs(useUserStore());

  installFlushOnHideOnce();

  const query = useQuery(
    computed(() => ({ ...todosQuery(), enabled: !!user.value })),
  );
  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('tasks.private_tasks.errors.load')),
  );

  const displayPrivateTasks = computed(() =>
    user.value ? arrangeTodos(query.data.value ?? []) : [],
  );
  const loading = computed(() => !!user.value && query.isPending.value);

  const openMenuId = ref<string | null>(null);

  useEventListener(document, 'click', () => {
    openMenuId.value = null;
  });

  const togglePrivateTaskCompletion = (task: Todo) => {
    const shown =
      displayPrivateTasks.value.find((todo) => todo.id === task.id) ?? task;
    pending.completed.set(task.id, !shown.completed);
    scheduleToggleSync(task.id);
  };

  const duplication = useMutation({
    mutationFn: (task: Todo) =>
      unwrap(
        api.POST('/todos', {
          body: { title: task.title, description: task.description },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('tasks.private_tasks.errors.duplicate')),
      ),
  });

  const removal = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/todos/{id}', { params: { path: { id } } })),
    onSuccess: (_, id) =>
      queryClient.setQueryData<Todo[]>(todoKeys.all, (todos) =>
        todos?.filter((todo) => todo.id !== id),
      ),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t('tasks.errors.delete'))),
    onSettled: (_, __, id) => {
      pending.removed.delete(id);
      return queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });

  const duplicatePrivateTask = (task: Todo) => duplication.mutate(task);

  const confirmDeletePrivateTask = () =>
    confirmModal.ask({
      title: t('tasks.list.tasks.menu.delete.title'),
      content: t('tasks.private_tasks.delete_confirm'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });

  const deletePrivateTask = async (id: string, { confirm = true } = {}) => {
    if (confirm && !(await confirmDeletePrivateTask())) return;
    pending.removed.add(id);
    removal.mutate(id);
  };

  const reorderPrivateTask = (
    id: string,
    prevPosition: string | null,
    nextPosition: string | null,
  ) => {
    if (!findCachedTodo(id)) return;
    if (prevPosition || nextPosition) {
      pending.positions.set(id, positionBetween(prevPosition, nextPosition));
    }
    reorderQueue.add(id);
    scheduleReorderSync();
  };

  return {
    user,
    displayPrivateTasks,
    loading,
    openMenuId,
    togglePrivateTaskCompletion,
    duplicatePrivateTask,
    confirmDeletePrivateTask,
    deletePrivateTask,
    reorderPrivateTask,
  };
}
