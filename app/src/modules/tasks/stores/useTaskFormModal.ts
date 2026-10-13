import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';
import type { ItemType, Task, TaskPrefill } from '@/modules/tasks/types';

type TaskType = Exclude<ItemType, 'all'>;

export interface TaskFormOptions {
  type?: TaskType;
  /** Opened from the group's own page, which already tells the group. */
  local?: boolean;
  prefill?: TaskPrefill;
}

interface TaskFormPayload {
  /** Fixed when the form opens, so navigating away cannot retarget it. */
  groupId: string;
  item: Task | null;
  type: TaskType;
  local: boolean;
  prefill: TaskPrefill;
}

export const useTaskFormModal = defineStore('task-form-modal', () => {
  const modal = useModalState<TaskFormPayload>();

  function openNew(
    groupId: string,
    { type = 'homework', local = false, prefill = {} }: TaskFormOptions = {},
  ) {
    modal.open({ groupId, item: null, type, local, prefill });
  }

  function openEdit(groupId: string, item: Task) {
    modal.open({ groupId, item, type: item.type, local: false, prefill: {} });
  }

  return { ...modal, openNew, openEdit };
});
