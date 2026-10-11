import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';
import type { ItemType, Task } from '@/modules/tasks/types';

type TaskType = Exclude<ItemType, 'all'>;

export interface TaskFormOptions {
  type?: TaskType;
  /** Opened from the group's own page, which already tells the group. */
  local?: boolean;
}

interface TaskFormPayload {
  /** Fixed when the form opens, so navigating away cannot retarget it. */
  groupId: string;
  item: Task | null;
  type: TaskType;
  local: boolean;
}

export const useTaskFormModal = defineStore('task-form-modal', () => {
  const modal = useModalState<TaskFormPayload>();

  function openNew(
    groupId: string,
    { type = 'homework', local = false }: TaskFormOptions = {},
  ) {
    modal.open({ groupId, item: null, type, local });
  }

  function openEdit(groupId: string, item: Task) {
    modal.open({ groupId, item, type: item.type, local: false });
  }

  return { ...modal, openNew, openEdit };
});
