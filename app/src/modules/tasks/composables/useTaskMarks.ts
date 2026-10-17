import { computed, reactive, watch, type Ref } from 'vue';
import { createEventHook, useEventListener } from '@vueuse/core';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { ItemIdsDto, VisibilityDto, VisibilityStatus } from '@/api/schema';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { Task } from '@/modules/tasks/types';
import { archivesOnItsOwn } from '@/modules/tasks/utils/archive';
import {
  taskChecksQuery,
  taskKeys,
  taskPinsQuery,
  taskVisibilityQuery,
} from '@/modules/tasks/utils/taskQueries';

// The UI updates instantly; the API call is debounced per task so rapid
// check/uncheck toggles collapse into at most one request, and requests
// for the same task never run in parallel (no out-of-order POST/DELETE).
const CHECK_SYNC_DELAY_MS = 400;

interface CheckSyncEntry {
  task: Task;
  serverChecked: boolean;
  /** The server cleared the task's archive status, as checking does. */
  checkedOnServer: boolean;
  timer?: number;
  inFlight: boolean;
}

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

  // Changes the server has not confirmed yet. They win over the loaded
  // marks, so a refetch arriving in between cannot undo a click; dropping
  // one shows the server's state again, which is how a failure rolls back.
  const checkOverrides = reactive(new Map<string, boolean>());
  const pinOverrides = reactive(new Map<string, boolean>());
  const visibilityOverrides = reactive(
    new Map<string, VisibilityStatus | null>(),
  );

  const loading = computed(
    () => checks.isLoading.value || pins.isLoading.value,
  );

  const isChecked = (id: string) =>
    isLoggedIn.value && (checkOverrides.get(id) ?? checkedIds.value.has(id));
  const isPinned = (id: string) =>
    isLoggedIn.value && (pinOverrides.get(id) ?? pinnedIds.value.has(id));

  function visibilityOf(id: string): VisibilityStatus | null {
    const override = visibilityOverrides.get(id);
    if (override !== undefined) return override;
    if (!isLoggedIn.value || checkOverrides.get(id) === true) return null;
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

  // Checks and pins are debounced and queued per task below, so these only
  // send the state a sync settled on; the queue decides when.
  const checkWrite = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) => {
      const path = '/groups/{group_id}/items/{id}/check';
      const init = itemParams(id);
      return unwrap(checked ? api.POST(path, init) : api.DELETE(path, init));
    },
  });

  const pinWrite = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => {
      const path = '/groups/{group_id}/items/{id}/pin';
      const init = itemParams(id);
      return unwrap(pinned ? api.POST(path, init) : api.DELETE(path, init));
    },
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

  const checkSync = new Map<string, CheckSyncEntry>();
  /** The pin state the server last confirmed, kept while a change is still syncing. */
  const pinConfirmed = new Map<string, boolean>();
  const pinQueue = new Map<string, Promise<void>>();

  function setChecked(task: Task, isNowChecked: boolean) {
    if (!isLoggedIn.value) return;
    const wasChecked = isChecked(task.id);
    if (wasChecked === isNowChecked) return;
    checkOverrides.set(task.id, isNowChecked);
    scheduleCheckSync(task, wasChecked);
  }

  function scheduleCheckSync(task: Task, wasChecked: boolean) {
    let entry = checkSync.get(task.id);
    if (!entry) {
      entry = {
        task,
        serverChecked: wasChecked,
        checkedOnServer: false,
        inFlight: false,
      };
      checkSync.set(task.id, entry);
    }
    entry.task = task;
    clearTimeout(entry.timer);
    entry.timer = window.setTimeout(
      () => void flushCheckSync(task.id),
      CHECK_SYNC_DELAY_MS,
    );
  }

  async function flushCheckSync(id: string) {
    const entry = checkSync.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.timer = undefined;
    // The running request re-checks the desired state when it finishes.
    if (entry.inFlight) return;

    const desired = isChecked(id);
    if (!isLoggedIn.value || desired === entry.serverChecked) {
      return settleCheck(entry);
    }

    entry.inFlight = true;
    let failed = false;
    try {
      await checkWrite.mutateAsync({ id, checked: desired });
      entry.serverChecked = desired;
      if (desired) entry.checkedOnServer = true;
    } catch {
      failed = true;
    } finally {
      entry.inFlight = false;
    }

    // Toggled again during the request; the new timer takes over.
    if (entry.timer !== undefined) return;

    if (failed) {
      const shown = isChecked(id);
      settleCheck(entry);
      if (shown !== entry.serverChecked) {
        void checkReverted.trigger({
          task: entry.task,
          checked: entry.serverChecked,
        });
      }
    } else if (isChecked(id) !== entry.serverChecked) {
      await flushCheckSync(id);
    } else {
      settleCheck(entry);
    }
  }

  function settleCheck(entry: CheckSyncEntry) {
    const id = entry.task.id;
    checkSync.delete(id);
    writeIds(taskKeys.checks(), id, entry.serverChecked);
    if (entry.checkedOnServer) writeVisibility(id, null);
    checkOverrides.delete(id);
  }

  // Send pending syncs right away when the page is hidden (tab switch/close).
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    for (const [id, entry] of checkSync) {
      if (entry.timer !== undefined) void flushCheckSync(id);
    }
  });

  // Pin requests for one task run one after another, each sending the state
  // the member ended on, so the server cannot end on an earlier click.
  async function syncPin(task: Task) {
    const confirmed = pinConfirmed.get(task.id);
    const desired = pinOverrides.get(task.id);
    if (confirmed === undefined || desired === undefined) return;
    if (confirmed === desired) return;

    try {
      await pinWrite.mutateAsync({ id: task.id, pinned: desired });
      pinConfirmed.set(task.id, desired);
    } catch {
      // Undone meanwhile, the click that failed is no longer what is shown.
      if (pinOverrides.get(task.id) !== desired) return;
      pinOverrides.set(task.id, confirmed);
      void pinReverted.trigger(task);
    }
  }

  function settlePin(id: string) {
    const confirmed = pinConfirmed.get(id);
    pinConfirmed.delete(id);
    if (confirmed !== undefined) writeIds(taskKeys.pins(), id, confirmed);
    pinOverrides.delete(id);
  }

  async function togglePin(task: Task) {
    if (!isLoggedIn.value) return;
    const id = task.id;
    const wasPinned = isPinned(id);
    if (!pinConfirmed.has(id)) pinConfirmed.set(id, wasPinned);
    pinOverrides.set(id, !wasPinned);

    const queued = (pinQueue.get(id) ?? Promise.resolve()).then(() =>
      syncPin(task),
    );
    pinQueue.set(id, queued);
    await queued;
    if (pinQueue.get(id) !== queued) return;
    pinQueue.delete(id);
    settlePin(id);
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

  // The overrides belong to whoever made them.
  watch(isLoggedIn, () => {
    checkOverrides.clear();
    pinOverrides.clear();
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
