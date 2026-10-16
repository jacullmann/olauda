import { onKeyStroke } from '@vueuse/core';
import { useAnnouncementFormModal } from '@/modules/announcements/stores/useAnnouncementFormModal';
import { useTodoFormModal } from '@/modules/todos/stores/useTodoFormModal';
import { useSearchModal } from '@/modules/search/stores/useSearchModal';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { useSidebarStore } from '@/shell/stores/useSidebarStore';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroupAction } from '@/modules/groups/composables/useGroupAction';
import { useGroups } from '@/modules/groups/composables/useGroups';

export function useAppShortcuts() {
  const searchModal = useSearchModal();
  const taskFormModal = useTaskFormModal();
  const privateTaskFormModal = useTodoFormModal();
  const announcementFormModal = useAnnouncementFormModal();
  const sidebarStore = useSidebarStore();
  const userStore = useUserStore();
  const { withGroup, canStartAction } = useGroupAction();
  const { canInAnyGroup } = useGroups();

  onKeyStroke(['k', 'K'], (e: KeyboardEvent) => {
    if (!userStore.user) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      searchModal.open();
    }
  });

  onKeyStroke(['n', 'N'], (e: KeyboardEvent) => {
    if (!userStore.user) return;
    if (!canStartAction('create_items')) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      withGroup((groupId) => taskFormModal.openNew(groupId), 'create_items');
    }
  });

  onKeyStroke(['p', 'P'], (e: KeyboardEvent) => {
    if (!userStore.user) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      privateTaskFormModal.openNew();
    }
  });

  onKeyStroke(['a', 'A'], (e: KeyboardEvent) => {
    if (!userStore.user) return;
    if (!canInAnyGroup('manage_announcements')) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      withGroup(
        (groupId) => announcementFormModal.openFor(groupId),
        'manage_announcements',
      );
    }
  });

  onKeyStroke(['g', 'G'], (e: KeyboardEvent) => {
    if (!userStore.user) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      searchModal.open('group');
    }
  });

  onKeyStroke(['d', 'D'], (e: KeyboardEvent) => {
    if (!userStore.user) return;

    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      sidebarStore.toggle();
    }
  });
}
