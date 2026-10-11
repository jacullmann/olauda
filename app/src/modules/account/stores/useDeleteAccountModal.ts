import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';

export const useDeleteAccountModal = defineStore('delete-account-modal', () =>
  useModalState(),
);
