import { computed, ref, shallowReactive } from 'vue';
import { useEventListener } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useKeyedSync } from '@/common/composables/useKeyedSync';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { Todo } from '@/modules/todos/types';
import { positionBetween, sortTodos } from '@/modules/todos/utils/todoOrder';
import { todoKeys, todosQuery } from '@/modules/todos/utils/todoQueries';

// Rapid toggles of one checkbox collapse into a single request.
const COMPLETION_SYNC_DELAY_MS = 400;

export function useTodos() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const confirmModal = useConfirmModal();
  const { user } = storeToRefs(useUserStore());

  const query = useQuery(
    computed(() => ({ ...todosQuery(), enabled: !!user.value })),
  );
  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('tasks.private_tasks.errors.load')),
  );

  /** Mirrors what the server confirmed it now holds. */
  const patchCachedTodo = (id: string, change: Partial<Todo>) =>
    queryClient.setQueryData<Todo[]>(todoKeys.all, (todos) =>
      todos?.map((todo) => (todo.id === id ? { ...todo, ...change } : todo)),
    );

  const completionWrite = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      unwrap(
        api.PUT('/todos/{id}/completed', {
          params: { path: { id } },
          body: { completed },
        }),
      ),
    onSuccess: ({ id, completed, updatedAt }) =>
      patchCachedTodo(id, { completed, updatedAt }),
  });

  const completion = useKeyedSync<string, boolean>({
    keyOf: (id) => id,
    delay: COMPLETION_SYNC_DELAY_MS,
    send: (id, completed) => completionWrite.mutateAsync({ id, completed }),
    onFailed: (_, __, error) =>
      toast.error(apiErrorMessage(error, t('tasks.errors.save_status'))),
  });

  // Where moved todos sort until every move is through. The keys only order
  // the list here; the server picks its own from the neighbour named.
  const movedPositions = shallowReactive(new Map<string, string>());
  const removed = shallowReactive(new Set<string>());

  const move = useMutation({
    mutationKey: todoKeys.order(),
    mutationFn: ({ id, afterId }: { id: string; afterId: string | null }) =>
      unwrap(
        api.PUT('/todos/{id}/position', {
          params: { path: { id } },
          body: { afterId },
        }),
      ),
    // Moves run one after another in the order they were made, so each one
    // finds the list as the moves before it left it.
    scope: { id: 'todo-order' },
    onSuccess: ({ id, position, updatedAt }) =>
      patchCachedTodo(id, { position, updatedAt }),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('tasks.private_tasks.errors.reorder')),
      ),
    onSettled: (_, error) => {
      // The last move through decides: the cache holds the server's order now.
      if (queryClient.isMutating({ mutationKey: todoKeys.order() }) > 1) {
        return;
      }
      movedPositions.clear();
      // Some moves may not have gone through; the server's order wins.
      if (error) void queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });

  const displayPrivateTasks = computed(() => {
    if (!user.value) return [];
    return sortTodos(
      (query.data.value ?? [])
        .filter((todo) => !removed.has(todo.id))
        .map((todo) => ({
          ...todo,
          completed: completion.pendingValue(todo.id) ?? todo.completed,
          position: movedPositions.get(todo.id) ?? todo.position,
        })),
    );
  });
  const loading = computed(() => !!user.value && query.isPending.value);

  const openMenuId = ref<string | null>(null);

  useEventListener(document, 'click', () => {
    openMenuId.value = null;
  });

  const togglePrivateTaskCompletion = (task: Todo) => {
    const shown =
      displayPrivateTasks.value.find((todo) => todo.id === task.id) ?? task;
    void completion.set(task.id, !shown.completed, shown.completed);
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
      removed.delete(id);
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
    removed.add(id);
    removal.mutate(id);
  };

  /** Moves the todo shown at index `from` to index `to`. */
  const reorderPrivateTask = (from: number, to: number) => {
    const order = [...displayPrivateTasks.value];
    const [moved] = order.splice(from, 1);
    if (!moved) return;
    order.splice(to, 0, moved);

    const above = order[to - 1];
    movedPositions.set(
      moved.id,
      positionBetween(above?.position || null, order[to + 1]?.position || null),
    );
    move.mutate({ id: moved.id, afterId: above?.id ?? null });
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
