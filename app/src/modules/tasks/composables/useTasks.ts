import {
  ref,
  computed,
  watch,
  onMounted,
  provide,
  inject,
  type InjectionKey,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useEventListener } from '@vueuse/core';
import { useQueryClient } from '@tanstack/vue-query';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useSubjectStore } from '@/modules/courses/stores/useSubjectStore';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useToast } from '@/common/composables/useToast';
import { useImageUpload } from './useImageUpload';
import { useTaskPermissions } from './useTaskPermissions';
import { subjectLabel } from '@/modules/courses/utils/subjectLabels';
import type { Task, TaskMenuAction } from '@/modules/tasks/types';
import { taskRoute } from '@/modules/tasks/utils/routes';
import { taskKeys } from '@/modules/tasks/utils/taskQueries';

import { useTaskFilters, type TaskFilters } from './useTaskFilters';
import { useTaskMarks } from './useTaskMarks';
import { useTaskDismissals } from './useTaskDismissals';
import { useTaskItems } from './useTaskItems';
import { useTaskDueOrder } from './useTaskDueOrder';
import { useTaskListView } from './useTaskListView';
import { useOpenedTask } from './useOpenedTask';
import { useTaskActions } from './useTaskActions';
import { useTaskNotes } from './useTaskNotes';
import { useTaskImages } from './useTaskImages';

export type { TaskFilters };

/** Lets the menu start closing before the card it belongs to folds away. */
const MENU_CLOSE_MS = 200;

function createTasks(fixedFilters: Partial<TaskFilters>) {
  const route = useRoute();
  const router = useRouter();
  const subjectStore = useSubjectStore();
  const taskFormModal = useTaskFormModal();
  const { user, isLoggedIn } = storeToRefs(useUserStore());
  const groupId = useGroupPageId();
  const imageUpload = useImageUpload(groupId);
  const permissions = useTaskPermissions(groupId);
  const toast = useToast();
  const queryClient = useQueryClient();
  const i18n = useI18n();
  const t = i18n.t.bind(i18n);
  const te = i18n.te.bind(i18n);

  const openedItemId = computed(() =>
    route.name === 'group-task' && typeof route.params.taskId === 'string'
      ? route.params.taskId
      : null,
  );
  const showPersonalized = computed(() => user.value?.personalized ?? false);

  const filters = useTaskFilters(fixedFilters);
  const { tab, showOldEntries, subjectFilter, hideChecked } = filters;
  const marks = useTaskMarks(groupId, isLoggedIn);
  const dismissals = useTaskDismissals({
    showOldEntries,
    hideChecked,
    isNaturallyOld: marks.isNaturallyOld,
  });
  const taskItems = useTaskItems(groupId, filters.filters, showPersonalized);
  const dueOrder = useTaskDueOrder(groupId, taskItems.items, showPersonalized);
  const listView = useTaskListView({
    items: dueOrder.orderedItems,
    hideChecked,
    isChecked: marks.isChecked,
    isPinned: marks.isPinned,
    pendingCheckRemovals: dismissals.pendingCheckRemovals,
  });
  const opened = useOpenedTask({
    groupId,
    openedItemId,
    findInList: taskItems.findInList,
    listUpdatedAt: taskItems.updatedAt,
  });

  const actions = useTaskActions(groupId);
  const notes = useTaskNotes(groupId);
  const images = useTaskImages({ isLoggedIn, imageUpload, permissions });

  const openMenuId = ref<string | null>(null);
  const infoItem = ref<Task | null>(null);

  useEventListener(document, 'click', () => {
    openMenuId.value = null;
  });

  const loading = computed(
    () => taskItems.loading.value || marks.loading.value,
  );

  const hasLoadedOnce = ref(false);
  watch(
    loading,
    (isLoading) => {
      if (!isLoading) hasLoadedOnce.value = true;
    },
    { immediate: true },
  );
  const initialLoad = computed(
    () => !hasLoadedOnce.value || taskItems.initialLoad.value,
  );

  function toggleCheck(task: Task) {
    if (!isLoggedIn.value) return;
    const isNowChecked = !marks.isChecked(task.id);
    marks.setChecked(task, isNowChecked);
    if (isNowChecked) dismissals.followCheck(task);
    else dismissals.restore(task.id);
  }

  marks.onCheckReverted(({ task, checked }) => {
    dismissals.followRevertedCheck(task, checked);
    toast.error(t('tasks.errors.save_status'));
  });

  marks.onPinReverted(() => {
    toast.error(t('tasks.errors.save_status'));
  });

  async function archiveItem(task: Task) {
    dismissals.dismiss(task.id);
    const success = await marks.setInArchive(task, !showOldEntries.value);
    if (success) return;
    dismissals.restore(task.id);
    toast.error(t('tasks.errors.save_status'));
  }

  /**
   * Moves a task into the archive or out of it by where the task is, not by
   * which of the two the list shows: an opened task may be in either.
   */
  async function toggleArchive(task: Task) {
    const isInArchive = marks.isInArchive(task);
    if (isInArchive === showOldEntries.value) return archiveItem(task);
    if (!(await marks.setInArchive(task, !isInArchive))) {
      toast.error(t('tasks.errors.save_status'));
      return;
    }
    // It joins the list, which may still hide it from an earlier dismissal.
    dismissals.restore(task.id);
    await queryClient.invalidateQueries({ queryKey: taskKeys.lists(groupId) });
  }

  function openItem(task: Task) {
    return router.push(taskRoute(groupId, task.id));
  }

  function editItem(task: Task) {
    taskFormModal.openEdit(groupId, task);
  }

  function openCreateForm() {
    taskFormModal.openNew(groupId, {
      type: tab.value === 'all' ? undefined : tab.value,
      local: true,
    });
  }

  async function onMenuAction(action: TaskMenuAction, task: Task) {
    openMenuId.value = null;
    switch (action) {
      case 'archive':
        await new Promise((resolve) => setTimeout(resolve, MENU_CLOSE_MS));
        return archiveItem(task);
      case 'images':
        return images.triggerImageUpload(task);
      case 'edit':
        return editItem(task);
      case 'addNote':
        notes.startEditNote(task);
        // The note is only shown on the task's own page.
        if (openedItemId.value !== task.id) await openItem(task);
        return;
      case 'delete':
        return actions.deleteItem(task.id);
      case 'report':
        return actions.reportItem(task);
      case 'pin':
        return marks.togglePin(task);
      case 'share':
        return actions.shareItem(task);
      case 'info':
        infoItem.value = task;
    }
  }

  const subjectOptions = computed(() => [
    { label: t('tasks.list.allsubjects'), value: '' },
    ...subjectStore.subjects.map((s) => ({
      label: subjectLabel(s.name, t, te),
      value: s.id,
    })),
  ]);

  watch([filters.filters, showPersonalized], () => {
    dismissals.clear();
    listView.resetVisibleCount();
  });

  // What the server lists, such as whether checked tasks are left out,
  // depends on who asks.
  watch(isLoggedIn, (loggedIn) => {
    if (!loggedIn) dismissals.clear();
    void taskItems.reloadList();
  });

  onMounted(() => {
    void subjectStore.loadSubjects(groupId);
  });

  return {
    user,
    loading,
    initialLoad,
    marksLoading: marks.loading,
    tab,
    subjectFilter,
    showOldEntries,
    hideChecked,
    showPersonalized,
    hiddenByCourses: taskItems.hiddenByCourses,
    listLoadError: taskItems.loadError,
    reloadList: taskItems.reloadList,
    subjectOptions,
    goTab: filters.goTab,
    resetFilters: filters.resetFilters,
    visibleCount: listView.visibleCount,
    filteredItems: listView.filteredItems,
    limitedItems: listView.limitedItems,
    hasMoreItems: listView.hasMoreItems,
    showMore: listView.showMore,
    dismissedItems: dismissals.dismissedItems,
    useListTransitions: dismissals.useListTransitions,
    openMenuId,
    infoItem,
    onMenuAction,
    openedItem: opened.openedItem,
    openedItemError: opened.openedItemError,
    retryOpenedItem: opened.retryOpenedItem,
    ...permissions,
    openCreateForm,
    isChecked: marks.isChecked,
    toggleCheck,
    isPinned: marks.isPinned,
    togglePin: marks.togglePin,
    isInArchive: marks.isInArchive,
    archiveItem,
    toggleArchive,
    deleteItem: actions.deleteItem,
    shareItem: actions.shareItem,
    showReportConfirm: actions.showReportConfirm,
    reportReason: actions.reportReason,
    doReport: actions.doReport,
    cancelReport: actions.cancelReport,
    editingNoteForId: notes.editingNoteForId,
    noteEditContent: notes.noteEditContent,
    savingNote: notes.savingNote,
    startEditNote: notes.startEditNote,
    cancelEditNote: notes.cancelEditNote,
    saveNote: notes.saveNote,
    deleteNote: notes.deleteNote,
    imageMenu: images.imageMenu,
    closeImageMenu: images.closeImageMenu,
    triggerImageUpload: images.triggerImageUpload,
    triggerImageDrop: images.triggerImageDrop,
    triggerImageDelete: images.triggerImageDelete,
    handleImageContextMenu: images.handleImageContextMenu,
  };
}

export type Tasks = ReturnType<typeof createTasks>;

const TASKS_KEY: InjectionKey<Tasks> = Symbol('tasks');

/**
 * Owned by the tasks page, so the list and a task opened from it share one
 * state: checks, pins and notes changed on either show on both, and the list
 * is still loaded and filtered when the task is closed again. The dashboard
 * owns one of its own for its task cards.
 */
export function provideTasks(fixedFilters: Partial<TaskFilters> = {}): Tasks {
  const tasks = createTasks(fixedFilters);
  provide(TASKS_KEY, tasks);
  return tasks;
}

export function useTasks(): Tasks {
  const tasks = inject(TASKS_KEY);
  if (!tasks) throw new Error('useTasks() used outside the tasks page');
  return tasks;
}
