import { reactive, ref, type Ref } from 'vue';
import { createEventHook, useEventListener } from '@vueuse/core';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { Task } from '@/modules/tasks/types';
import { archivesOnItsOwn } from '@/modules/tasks/utils/archive';

// The UI updates instantly; the API call is debounced per task so rapid
// check/uncheck toggles collapse into at most one request, and requests
// for the same task never run in parallel (no out-of-order POST/DELETE).
const CHECK_SYNC_DELAY_MS = 400;

interface CheckSyncEntry {
  task: Task;
  serverChecked: boolean;
  /** Whether the task was kept before the first toggle, restored if the sync fails. */
  wasKept: boolean;
  timer?: number;
  inFlight: boolean;
}

export interface CheckReverted {
  task: Task;
  checked: boolean;
}

type VisibilityStatus = 'archived' | 'kept';

function replaceIds(set: Set<string>, ids: Iterable<string> = []) {
  set.clear();
  for (const id of ids) set.add(id);
}

/** What the member marked on the group's tasks: checks, pins and archive overrides. */
export function useTaskMarks(
  groupId: string,
  isLoggedIn: Readonly<Ref<boolean>>,
) {
  const checked = reactive(new Set<string>());
  const pinned = reactive(new Set<string>());
  const archived = reactive(new Set<string>());
  const kept = reactive(new Set<string>());
  const checksLoading = ref(true);
  const pinsLoading = ref(true);
  const checkReverted = createEventHook<CheckReverted>();
  const { settings } = usePageSettings('tasks');

  const taskPath = (id: string, path: string) =>
    groupPath(groupId, `/items/${id}${path}`);

  const isChecked = (id: string) => checked.has(id);
  const isPinned = (id: string) => pinned.has(id);

  /** Where the server's list filter puts the task, see `setInArchive`. */
  function isInArchive(task: Task) {
    if (archived.has(task.id)) return true;
    if (kept.has(task.id)) return false;
    return isNaturallyOld(task);
  }

  function isNaturallyOld(task: Task) {
    return archivesOnItsOwn(
      task,
      { checked: isChecked(task.id), pinned: isPinned(task.id) },
      settings.value,
    );
  }

  async function loadIds(
    set: Set<string>,
    loading: Ref<boolean>,
    path: string,
  ) {
    loading.value = true;
    try {
      const { data } = await api.get<{ itemIds?: string[] }>(path);
      replaceIds(set, data.itemIds);
    } catch {
      // Keeps the marks already shown, see loadVisibility.
    } finally {
      loading.value = false;
    }
  }

  // A failed read keeps the last known marks: clearing them would show the
  // member's pins and checks as gone for a request that merely dropped.
  async function loadVisibility() {
    try {
      const { data } = await api.get<{ archived?: string[]; kept?: string[] }>(
        '/user/visibility',
      );
      replaceIds(archived, data.archived);
      replaceIds(kept, data.kept);
    } catch {
      // Keep the marks already shown; a reload retries the read.
    }
  }

  function clear() {
    checked.clear();
    pinned.clear();
    archived.clear();
    kept.clear();
    pinConfirmed.clear();
    checksLoading.value = false;
    pinsLoading.value = false;
  }

  async function load() {
    if (!isLoggedIn.value) return clear();
    await Promise.all([
      loadIds(checked, checksLoading, '/user/checks'),
      loadIds(pinned, pinsLoading, '/user/pins'),
      loadVisibility(),
    ]);
  }

  const checkSync = new Map<string, CheckSyncEntry>();
  /** The pin state the server last confirmed, kept while a change is still syncing. */
  const pinConfirmed = new Map<string, boolean>();
  const pinQueue = new Map<string, Promise<void>>();

  function setChecked(task: Task, isNowChecked: boolean) {
    if (!isLoggedIn.value) return;
    const wasChecked = isChecked(task.id);
    if (wasChecked === isNowChecked) return;
    const wasKept = kept.has(task.id);

    if (isNowChecked) {
      checked.add(task.id);
      kept.delete(task.id);
    } else {
      checked.delete(task.id);
    }
    scheduleCheckSync(task, wasChecked, wasKept);
  }

  function scheduleCheckSync(
    task: Task,
    wasChecked: boolean,
    wasKept: boolean,
  ) {
    let entry = checkSync.get(task.id);
    if (!entry) {
      entry = { task, serverChecked: wasChecked, wasKept, inFlight: false };
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
      checkSync.delete(id);
      return;
    }

    entry.inFlight = true;
    let failed = false;
    try {
      if (desired) await api.post(taskPath(id, '/check'));
      else await api.delete(taskPath(id, '/check'));
      entry.serverChecked = desired;
    } catch {
      failed = true;
    } finally {
      entry.inFlight = false;
    }

    // Toggled again during the request; the new timer takes over.
    if (entry.timer !== undefined) return;

    if (failed) {
      checkSync.delete(id);
      revertCheck(entry);
    } else if (isChecked(id) !== entry.serverChecked) {
      await flushCheckSync(id);
    } else {
      checkSync.delete(id);
    }
  }

  function revertCheck({ task, serverChecked, wasKept }: CheckSyncEntry) {
    if (isChecked(task.id) === serverChecked) return;
    if (serverChecked) {
      checked.add(task.id);
    } else {
      checked.delete(task.id);
      if (wasKept) kept.add(task.id);
    }
    void checkReverted.trigger({ task, checked: serverChecked });
  }

  // Send pending syncs right away when the page is hidden (tab switch/close).
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    for (const [id, entry] of checkSync) {
      if (entry.timer !== undefined) void flushCheckSync(id);
    }
  });

  function setPinned(id: string, value: boolean) {
    if (value) pinned.add(id);
    else pinned.delete(id);
  }

  // Pin requests for one task run one after another, each sending the state
  // the member ended on, so the server cannot end on an earlier click.
  async function syncPin(id: string) {
    const confirmed = pinConfirmed.get(id);
    const desired = isPinned(id);
    if (confirmed === undefined || confirmed === desired) {
      pinConfirmed.delete(id);
      return;
    }

    try {
      if (desired) await api.post(taskPath(id, '/pin'));
      else await api.delete(taskPath(id, '/pin'));
      pinConfirmed.set(id, desired);
    } catch {
      setPinned(id, confirmed);
      pinConfirmed.delete(id);
    }
  }

  async function togglePin(task: Task) {
    if (!isLoggedIn.value) return;
    const id = task.id;
    if (!pinConfirmed.has(id)) pinConfirmed.set(id, isPinned(id));
    setPinned(id, !isPinned(id));

    const queued = (pinQueue.get(id) ?? Promise.resolve()).then(() =>
      syncPin(id),
    );
    pinQueue.set(id, queued);
    await queued;
    if (pinQueue.get(id) === queued) pinQueue.delete(id);
  }

  function setVisibilityStatus(id: string, status: VisibilityStatus | null) {
    archived.delete(id);
    kept.delete(id);
    if (status === 'archived') archived.add(id);
    if (status === 'kept') kept.add(id);
  }

  /**
   * Moves a task into the archive or out of it, storing only what differs
   * from where the server's list filter would put it on its own.
   */
  async function setInArchive(
    task: Task,
    inArchive: boolean,
  ): Promise<boolean> {
    const id = task.id;
    const original: VisibilityStatus | null = archived.has(id)
      ? 'archived'
      : kept.has(id)
        ? 'kept'
        : null;
    const naturallyOld = isNaturallyOld(task);
    const status: VisibilityStatus | null = inArchive
      ? naturallyOld
        ? null
        : 'archived'
      : naturallyOld
        ? 'kept'
        : null;

    setVisibilityStatus(id, status);
    if (!isLoggedIn.value) return true;

    try {
      if (status === null) await api.delete(taskPath(id, '/visibility'));
      else await api.post(taskPath(id, '/visibility'), { status });
      return true;
    } catch {
      setVisibilityStatus(id, original);
      return false;
    }
  }

  return {
    checksLoading,
    pinsLoading,
    isChecked,
    isPinned,
    isInArchive,
    isNaturallyOld,
    load,
    clear,
    setChecked,
    togglePin,
    setInArchive,
    onCheckReverted: checkReverted.on,
  };
}

export type TaskMarks = ReturnType<typeof useTaskMarks>;
