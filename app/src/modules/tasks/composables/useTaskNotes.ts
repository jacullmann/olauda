import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { Task } from '@/modules/tasks/types';
import { updateCachedTask } from '@/modules/tasks/utils/taskQueries';

/** The editor's note on a task, edited in place on the task's own page. */
export function useTaskNotes(groupId: string) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();

  const editingNoteForId = ref<string | null>(null);
  const noteEditContent = ref('');

  const noteWrite = useMutation({
    mutationFn: ({
      taskId,
      editorNote,
    }: {
      taskId: string;
      editorNote: string;
    }) =>
      unwrap(
        api.PATCH('/groups/{group_id}/items/{id}/note', {
          params: { path: { group_id: groupId, id: taskId } },
          body: { editorNote },
        }),
      ),
    onSuccess: ({ editorNote }, { taskId }) =>
      updateCachedTask(queryClient, groupId, taskId, { editorNote }),
  });
  const savingNote = noteWrite.isPending;

  function startEditNote(task: Task) {
    editingNoteForId.value = task.id;
    noteEditContent.value = task.editorNote || '';
  }

  function cancelEditNote() {
    editingNoteForId.value = null;
    noteEditContent.value = '';
  }

  async function saveNote(taskId: string) {
    if (savingNote.value) return;
    try {
      await noteWrite.mutateAsync({
        taskId,
        editorNote: noteEditContent.value,
      });
      cancelEditNote();
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.notes.errors.save')));
    }
  }

  async function deleteNote(taskId: string) {
    const isConfirmed = await confirmModal.ask({
      title: t('tasks.notes.delete_modal.title'),
      content: t('tasks.notes.delete_modal.message'),
      submitText: t('tasks.notes.delete_modal.submit'),
      danger: true,
    });
    if (!isConfirmed || savingNote.value) return;

    try {
      await noteWrite.mutateAsync({ taskId, editorNote: '' });
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.notes.errors.delete')));
    }
  }

  return {
    editingNoteForId,
    noteEditContent,
    savingNote,
    startEditNote,
    cancelEditNote,
    saveNote,
    deleteNote,
  };
}
