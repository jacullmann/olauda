import { defineStore } from 'pinia';
import { useModalState } from '@/common/composables/useModalState';
import type { Todo } from '@/modules/todos/types';

export const useTodoFormModal = defineStore('todo-form-modal', () => {
  const modal = useModalState<
    {
      task: Todo | null;
      /** Opened from the private task list, which shows the new task. */
      local: boolean;
    },
    Todo
  >();

  function openNew({ local = false } = {}) {
    modal.open({ task: null, local });
  }

  function openEdit(task: Todo) {
    modal.open({ task, local: true });
  }

  return { ...modal, openNew, openEdit };
});
