import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';

export const useCreateGroupModal = defineStore('create-group-modal', () =>
  useModalState(),
);
