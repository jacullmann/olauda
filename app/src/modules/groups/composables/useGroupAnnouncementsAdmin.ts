import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import type { Announcement } from '@/modules/announcements/types';
import { useConfirmModal } from '@/stores/modalStore';
import { useAnnouncementStore } from '@/stores/announcementStore';

/** The group's announcements, as its admins manage them. */
export function useGroupAnnouncementsAdmin() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const announcementStore = useAnnouncementStore();

  const announcements = ref<Announcement[]>([]);

  async function loadAnnouncements() {
    try {
      const { data } = await api.get<Announcement[]>(
        groupPath(groupId, '/announcements'),
      );
      announcements.value = data;
    } catch {
      // Announcements are supplementary; keep the previously loaded list.
    }
  }

  async function deleteAnnouncement(id: string) {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.announcements.delete_modal.title'),
      content: t('groups.settings.announcements.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!isConfirmed) return;

    try {
      await api.delete(groupPath(groupId, `/admin/announcements/${id}`));
      announcements.value = announcements.value.filter((a) => a.id !== id);
      announcementStore.remove(id);
    } catch {
      toast.error(t('announcements.errors.delete'));
    }
  }

  onMounted(loadAnnouncements);

  return { announcements, loadAnnouncements, deleteAnnouncement };
}
