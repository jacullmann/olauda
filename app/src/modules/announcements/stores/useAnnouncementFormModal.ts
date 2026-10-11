import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';

export const useAnnouncementFormModal = defineStore(
  'announcement-form-modal',
  () => {
    const modal = useModalState<{ groupId: string; local: boolean }>();

    function openFor(groupId: string, { local = false } = {}) {
      modal.open({ groupId, local });
    }

    return { ...modal, openFor };
  },
);
