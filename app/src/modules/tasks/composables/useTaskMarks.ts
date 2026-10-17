import { computed, reactive, watch, type Ref } from 'vue';
import { createEventHook } from '@vueuse/core';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { ItemIdsDto, VisibilityDto, VisibilityStatus } from '@/api/schema';
import { useKeyedSync } from '@/common/composables/useKeyedSync';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { Task } from '@/modules/tasks/types';
import { archivesOnItsOwn } from '@/modules/tasks/utils/archive';
import {
  taskChecksQuery,
  taskKeys,
  taskPinsQuery,
  taskVisibilityQuery,
} from '@/modules/tasks/utils/taskQueries';

// Rapid check/uncheck toggles collapse into one request. A pin is a
// deliberate menu action and goes out at once.
const CHECK_SYNC_DELAY_MS = 400;
const PIN_SYNC_DELAY_MS = 0;

export interface CheckReverted {
  task: Task;
  checked: boolean;
}

function withId(ids: string[], id: string, included: boolean): string[] {
  const without = ids.filter((other) => other !== id);
  return included ? [...without, id] : without;
}

/**
 * What the member marked on the group's tasks: checks, pins and archive
 * overrides. The server keeps them for all groups at once, so they are
 * loaded and cached once for all of them.
 */
export function useTaskMarks(
  groupId: string,
  isLoggedIn: Readonly<Ref<boolean>>,
) {
  const queryClient = useQueryClient();
  const { settings } = usePageSettings('tasks');
  const checkReverted = createEventHook<CheckReverted>();
  const pinReverted = createEventHook<Task>();

  const checks = useQuery({ ...taskChecksQuery(), enabled: isLoggedIn });
  const pins = useQuery({ ...taskPinsQuery(), enabled: isLoggedIn });
  const visibility = useQuery({
    ...taskVisibilityQuery(),
    enabled: isLoggedIn,
  });

  const checkedIds = computed(() => new Set(checks.data.value?.itemIds));
  const pinnedIds = computed(() => new Set(pins.data.value?.itemIds));
  const storedVisibility = computed(() => {
    const statuses = new Map<string, VisibilityStatus>();
    for (const id of visibility.data.value?.archived ?? []) {
      statuses.set(id, 'archived');
    }
    for (const id of visibility.data.value?.kept ?? []) {
      statuses.set(id, 'kept');
    }
    return statuses;
  });

  // Archive moves the server has not confirmed yet. Like the checks and pins
  // still syncing, they win over the loaded marks, so a refetch arriving in
  // between cannot undo a click; dropping one shows the server's state again.
  const visibilityOverrides = reactive(
    new Map<string, VisibilityStatus | null>(),
  );

  const loading = computed(
    () => checks.isLoading.value || pins.isLoading.value,
  );

  const isChecked = (id: string) =>
    isLoggedIn.value &&
    (checkSync.pendingValue(id) ?? checkedIds.value.has(id));
  const isPinned = (id: string) =>
    isLoggedIn.value && (pinSync.pendingValue(id) ?? pinnedIds.value.has(id));

  function visibilityOf(id: string): VisibilityStatus | null {
    const override = visibilityOverrides.get(id);
    if (override !== undefined) return override;
    if (!isLoggedIn.value || checkSync.pendingValue(id) === true) return null;
    return storedVisibility.value.get(id) ?? null;
  }

  /** Where the server's list filter puts the task, see `setInArchive`. */
  function isInArchive(task: Task) {
    const status = visibilityOf(task.id);
    if (status === 'archived') return true;
    if (status === 'kept') return false;
    return isNaturallyOld(task);
  }

  function isNaturallyOld(task: Task) {
    return archivesOnItsOwn(
      task,
      { checked: isChecked(task.id), pinned: isPinned(task.id) },
      settings.value,
    );
  }

  /**
   * Stores what the server confirmed. A refetch that started before the
   * change could otherwise land after it and show the old state again.
   * Marks that never loaded have nothing to write into, so they are loaded
   * anew, which includes the change.
   */
  function writeConfirmed<T>(queryKey: QueryKey, change: (current: T) => T) {
    if (queryClient.getQueryData<T>(queryKey) === undefined) {
      void queryClient.invalidateQueries({ queryKey });
      return;
    }
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<T>(
      queryKey,
      (current) => current && change(current),
    );
  }

  const writeIds = (queryKey: QueryKey, id: string, included: boolean) =>
    writeConfirmed<ItemIdsDto>(queryKey, ({ itemIds }) => ({
      itemIds: withId(itemIds, id, included),
    }));

  const writeVisibility = (id: string, status: VisibilityStatus | null) =>
    writeConfirmed<VisibilityDto>(taskKeys.visibility(), (stored) => ({
      archived: withId(stored.archived, id, status === 'archived'),
      kept: withId(stored.kept, id, status === 'kept'),
    }));

  const itemParams = (id: string) => ({
    params: { path: { group_id: groupId, id } },
  });

  const checkWrite = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) => {
      const path = '/groups/{group_id}/items/{id}/check';
      const init = itemParams(id);
      return unwrap(checked ? api.POST(path, init) : api.DELETE(path, init));
    },
    onSuccess: (_, { id, checked }) => {
      writeIds(taskKeys.checks(), id, checked);
      // Checking clears the task's archive status on the server.
      if (checked) writeVisibility(id, null);
    },
  });

  const pinWrite = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => {
      const path = '/groups/{group_id}/items/{id}/pin';
      const init = itemParams(id);
      return unwrap(pinned ? api.POST(path, init) : api.DELETE(path, init));
    },
    onSuccess: (_, { id, pinned }) => writeIds(taskKeys.pins(), id, pinned),
  });

  const checkSync = useKeyedSync<Task, boolean>({
    keyOf: (task) => task.id,
    delay: CHECK_SYNC_DELAY_MS,
    send: ({ id }, checked) => checkWrite.mutateAsync({ id, checked }),
    onFailed: (task, checked) => void checkReverted.trigger({ task, checked }),
  });

  const pinSync = useKeyedSync<Task, boolean>({
    keyOf: (task) => task.id,
    delay: PIN_SYNC_DELAY_MS,
    send: ({ id }, pinned) => pinWrite.mutateAsync({ id, pinned }),
    onFailed: (task) => void pinReverted.trigger(task),
  });

  const visibilityWrite = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: VisibilityStatus | null;
    }) => {
      const path = '/groups/{group_id}/items/{id}/visibility';
      const init = itemParams(id);
      return unwrap(
        status === null
          ? api.DELETE(path, init)
          : api.POST(path, { ...init, body: { status } }),
      );
    },
    onMutate: ({ id, status }) => {
      visibilityOverrides.set(id, status);
    },
    onSuccess: (_, { id, status }) => writeVisibility(id, status),
    onSettled: (_, __, { id, status }) => {
      // A later move of the same task owns the override by now.
      if (visibilityOverrides.get(id) === status) {
        visibilityOverrides.delete(id);
      }
    },
  });

  function setChecked(task: Task, isNowChecked: boolean) {
    if (!isLoggedIn.value) return;
    const wasChecked = isChecked(task.id);
    if (wasChecked === isNowChecked) return;
    void checkSync.set(task, isNowChecked, wasChecked);
  }

  /** Resolves once the pin state the member ended on is synced. */
  function togglePin(task: Task): Promise<void> {
    if (!isLoggedIn.value) return Promise.resolve();
    const wasPinned = isPinned(task.id);
    return pinSync.set(task, !wasPinned, wasPinned);
  }

  /**
   * Moves a task into the archive or out of it, storing only what differs
   * from where the server's list filter would put it on its own. Resolves to
   * whether the server took it.
   */
  async function setInArchive(
    task: Task,
    inArchive: boolean,
  ): Promise<boolean> {
    const id = task.id;
    const naturallyOld = isNaturallyOld(task);
    const status: VisibilityStatus | null = inArchive
      ? naturallyOld
        ? null
        : 'archived'
      : naturallyOld
        ? 'kept'
        : null;

    // Without an account, the choice lasts as long as the page.
    if (!isLoggedIn.value) {
      visibilityOverrides.set(id, status);
      return true;
    }

    try {
      await visibilityWrite.mutateAsync({ id, status });
      return true;
    } catch {
      return false;
    }
  }

  // Pending changes belong to whoever made them.
  watch(isLoggedIn, () => {
    checkSync.reset();
    pinSync.reset();
    visibilityOverrides.clear();
  });

  return {
    loading,
    isChecked,
    isPinned,
    isInArchive,
    isNaturallyOld,
    setChecked,
    togglePin,
    setInArchive,
    onCheckReverted: checkReverted.on,
    onPinReverted: pinReverted.on,
  };
}

export type TaskMarks = ReturnType<typeof useTaskMarks>;
