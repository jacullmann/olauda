import { reactive, ref, type Ref } from 'vue';
import { tryOnScopeDispose, useTimeoutFn } from '@vueuse/core';
import type { Task } from '@/modules/tasks/types';
import { COLLAPSE_MS } from '@/common/utils/collapse';

/** A checked task stays in place this long, so its tick registers before it leaves. */
const CHECK_DISMISS_DELAY_MS = 400;
/** Matches `.task-list-move` on the pages that list tasks. */
const LIST_MOVE_MS = 500;
/** A dismissal waits out its delay, folds away, then the rows below move up. */
const LIST_TRANSITION_WINDOW_MS =
  CHECK_DISMISS_DELAY_MS + COLLAPSE_MS + LIST_MOVE_MS;

interface DismissalOptions {
  showOldEntries: Readonly<Ref<boolean>>;
  hideChecked: Readonly<Ref<boolean>>;
  isNaturallyOld: (task: Task) => boolean;
}

/**
 * Tasks that leave the loaded list because of what was done to them, ahead of
 * the next reload. List transitions run only while such a task is leaving, so
 * a reload or a filter change swaps the list at once.
 */
export function useTaskDismissals({
  showOldEntries,
  hideChecked,
  isNaturallyOld,
}: DismissalOptions) {
  const dismissedItems = reactive(new Set<string>());
  /** Checked while checked tasks are hidden, but not yet gone from the list. */
  const pendingCheckRemovals = reactive(new Set<string>());
  const useListTransitions = ref(false);
  const dismissTimers = new Map<string, number>();

  const { start: endListTransitionsLater } = useTimeoutFn(
    () => {
      useListTransitions.value = false;
    },
    LIST_TRANSITION_WINDOW_MS,
    { immediate: false },
  );

  function animateListChanges() {
    useListTransitions.value = true;
    endListTransitionsLater();
  }

  /** Asked once the task is checked, as the check decides where it goes. */
  function leavesOldView(task: Task) {
    return !showOldEntries.value && isNaturallyOld(task);
  }

  function cancelDismissTimer(id: string) {
    clearTimeout(dismissTimers.get(id));
    dismissTimers.delete(id);
  }

  function dismiss(id: string) {
    animateListChanges();
    dismissedItems.add(id);
  }

  function restore(id: string) {
    cancelDismissTimer(id);
    pendingCheckRemovals.delete(id);
    dismissedItems.delete(id);
  }

  function followCheck(task: Task) {
    const dismissesFromOldView = leavesOldView(task);
    const hidesChecked = hideChecked.value;
    if (!dismissesFromOldView && !hidesChecked) return;

    animateListChanges();
    if (hidesChecked) pendingCheckRemovals.add(task.id);
    cancelDismissTimer(task.id);
    dismissTimers.set(
      task.id,
      window.setTimeout(() => {
        dismissTimers.delete(task.id);
        pendingCheckRemovals.delete(task.id);
        if (dismissesFromOldView) dismissedItems.add(task.id);
      }, CHECK_DISMISS_DELAY_MS),
    );
  }

  /** A check the server refused is undone without animating the list. */
  function followRevertedCheck(task: Task, checked: boolean) {
    if (!checked) restore(task.id);
    else if (leavesOldView(task)) dismissedItems.add(task.id);
  }

  function clear() {
    for (const id of dismissTimers.keys()) cancelDismissTimer(id);
    dismissedItems.clear();
    pendingCheckRemovals.clear();
  }

  tryOnScopeDispose(clear);

  return {
    dismissedItems,
    pendingCheckRemovals,
    useListTransitions,
    dismiss,
    restore,
    followCheck,
    followRevertedCheck,
    clear,
  };
}
