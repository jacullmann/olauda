import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';
import type { MorphOrigin } from '@/common/utils/morph';

export const useAnnouncementListModal = defineStore(
  'announcement-list-modal',
  () => {
    const modal = useModalState<{ origin: MorphOrigin | null }>();

    function show(origin: MorphOrigin | null = null) {
      modal.open({ origin });
    }

    return { ...modal, show };
  },
);
