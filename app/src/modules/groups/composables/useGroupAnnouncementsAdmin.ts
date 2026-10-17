import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from './useGroupPageId';
import type { Announcement } from '@/modules/announcements/types';
import { groupAnnouncementsQuery } from '@/modules/announcements/utils/announcementQueries';
import { groupKeys } from '@/modules/groups/utils/groupQueries';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';

/** The group's announcements, as its admins manage them. */
export function useGroupAnnouncementsAdmin() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const confirmModal = useConfirmModal();

  // Announcements are supplementary: a failed load keeps what was loaded.
  const query = useQuery(groupAnnouncementsQuery(groupId));
  const announcements = computed<Announcement[]>(() => query.data.value ?? []);

  const removal = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/announcements/{id}', {
          params: { path: { group_id: groupId, id } },
        }),
      ),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t('announcements.errors.delete'))),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: groupKeys.topic(groupId, 'announcements'),
      }),
  });

  async function deleteAnnouncement(id: string) {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.announcements.delete_modal.title'),
      content: t('groups.settings.announcements.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (isConfirmed) removal.mutate(id);
  }

  return { announcements, deleteAnnouncement };
}
