import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { AdminSystemAnnouncement } from '@/modules/admin/types';
import {
  adminSystemAnnouncementsQuery,
  invalidateSystemAnnouncements,
} from '@/modules/admin/utils/adminQueries';

export function useAdminAnnouncements() {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const query = useQuery(adminSystemAnnouncementsQuery());
  const announcements = computed(() => query.data.value ?? []);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('admin.announcements.errors.load')),
  );

  const active = computed(() =>
    announcements.value.filter((a) => a.status === 'active'),
  );
  // The next to go live comes first.
  const scheduled = computed(() =>
    announcements.value.filter((a) => a.status === 'scheduled').toReversed(),
  );

  const deletion = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/admin/system-announcements/{id}', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => invalidateSystemAnnouncements(queryClient),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('admin.announcements.errors.delete')),
      ),
  });

  async function remove(announcement: AdminSystemAnnouncement) {
    const confirmed = await confirmModal.ask({
      title: t('admin.announcements.delete_modal.title'),
      content: t(`admin.announcements.delete_modal.${announcement.status}`),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (confirmed) deletion.mutate(announcement.id);
  }

  return { active, scheduled, loading: query.isPending, remove };
}
