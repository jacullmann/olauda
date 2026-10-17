import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from './useGroupPageId';
import type { ScheduleSubstitution } from '@/modules/groups/types';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import {
  groupAdminSubstitutionsQuery,
  groupKeys,
} from '@/modules/groups/utils/groupQueries';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';

/** Every change entered against the group's schedule, past weeks included. */
export function useGroupScheduleChanges() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const confirmModal = useConfirmModal();

  const query = useQuery(groupAdminSubstitutionsQuery(groupId));
  const changes = computed<ScheduleSubstitution[]>(
    () => query.data.value ?? [],
  );

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('schedule.errors.load_changes')),
  );

  const removal = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/schedule/subs/{id}', {
          params: { path: { group_id: groupId, id } },
        }),
      ),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t('schedule.errors.delete_change'))),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: groupKeys.topic(groupId, 'schedule'),
      }),
  });

  async function deleteChange(id: string) {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.schedule.changes.delete_modal.title'),
      content: t('groups.settings.schedule.changes.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (isConfirmed) removal.mutate(id);
  }

  return {
    changes,
    loadingChanges: query.isFetching,
    loadChanges: () => void query.refetch(),
    deleteChange,
  };
}
