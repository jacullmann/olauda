import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import type { ScheduleSubstitution } from '@/modules/groups/types';
import { useConfirmModal } from '@/stores/modalStore';

/** Every change entered against the group's schedule, past weeks included. */
export function useGroupScheduleChanges() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();

  const changes = ref<ScheduleSubstitution[]>([]);
  const loadingChanges = ref(false);

  async function loadChanges() {
    loadingChanges.value = true;
    try {
      const { data } = await api.get<ScheduleSubstitution[]>(
        groupPath(groupId, '/admin/schedule/subs'),
      );
      changes.value = data;
    } catch {
      toast.error(t('schedule.errors.load_changes'));
    } finally {
      loadingChanges.value = false;
    }
  }

  async function deleteChange(id: string) {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.schedule.changes.delete_modal.title'),
      content: t('groups.settings.schedule.changes.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!isConfirmed) return;

    try {
      await api.delete(groupPath(groupId, `/admin/schedule/subs/${id}`));
      changes.value = changes.value.filter((change) => change.id !== id);
    } catch {
      toast.error(t('schedule.errors.delete_change'));
    }
  }

  onMounted(loadChanges);

  return { changes, loadingChanges, loadChanges, deleteChange };
}
