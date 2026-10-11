import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { AdminSystemAnnouncement } from '../types';

const ENDPOINT = '/admin/system-announcements';

export function useSuperAdminAnnouncements() {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { t } = useI18n();

  /** Latest start first, as the server sends them. */
  const announcements = ref<AdminSystemAnnouncement[]>([]);
  const loading = ref(false);

  const active = computed(() =>
    announcements.value.filter((a) => a.status === 'active'),
  );
  // The next to go live comes first.
  const scheduled = computed(() =>
    announcements.value.filter((a) => a.status === 'scheduled').toReversed(),
  );

  async function load() {
    loading.value = true;
    try {
      const { data } = await api.get<AdminSystemAnnouncement[]>(ENDPOINT);
      announcements.value = data;
    } catch {
      toast.error(t('admin.announcements.errors.load'));
    } finally {
      loading.value = false;
    }
  }

  async function remove(announcement: AdminSystemAnnouncement) {
    const confirmed = await confirmModal.ask({
      title: t('admin.announcements.delete_modal.title'),
      content: t(`admin.announcements.delete_modal.${announcement.status}`),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.delete(`${ENDPOINT}/${announcement.id}`);
      announcements.value = announcements.value.filter(
        (a) => a.id !== announcement.id,
      );
    } catch {
      toast.error(t('admin.announcements.errors.delete'));
    }
  }

  return { active, scheduled, loading, load, remove };
}
