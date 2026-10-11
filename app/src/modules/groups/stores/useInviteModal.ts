import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';

export const useInviteModal = defineStore('invite-modal', () =>
  useModalState<{ groupId: string; token: string }>(),
);
