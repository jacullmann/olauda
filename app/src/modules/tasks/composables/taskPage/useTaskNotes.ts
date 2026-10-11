import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { Task } from '@/modules/tasks/types';

/** The editor's note on a task, edited in place on the task's own page. */
export function useTaskNotes(
  groupId: string,
  findLoadedTask: (taskId: string) => Task | undefined,
) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();

  const editingNoteForId = ref<string | null>(null);
  const noteEditContent = ref('');
  const savingNote = ref(false);

  function startEditNote(task: Task) {
    editingNoteForId.value = task.id;
    noteEditContent.value = task.editorNote || '';
  }

  function cancelEditNote() {
    editingNoteForId.value = null;
    noteEditContent.value = '';
  }

  async function writeNote(taskId: string, editorNote: string) {
    await api.patch(groupPath(groupId, `/items/${taskId}/note`), {
      editorNote,
    });
    const task = findLoadedTask(taskId);
    if (task) task.editorNote = editorNote;
  }

  async function saveNote(taskId: string) {
    if (savingNote.value) return;
    savingNote.value = true;
    try {
      await writeNote(taskId, noteEditContent.value);
      toast.success(t('tasks.list.notes.saved'));
      cancelEditNote();
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.notes.errors.save')));
    } finally {
      savingNote.value = false;
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

    savingNote.value = true;
    try {
      await writeNote(taskId, '');
      toast.success(t('tasks.notes.delete_modal.success'));
    } catch (e) {
      toast.error(apiErrorMessage(e, t('tasks.notes.errors.delete')));
    } finally {
      savingNote.value = false;
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
