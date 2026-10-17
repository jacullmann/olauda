import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useGroupPageId } from './useGroupPageId';
import { useGroups } from './useGroups';
import type { BannedMember } from '@/modules/groups/types';
import { groupBansQuery, groupKeys } from '@/modules/groups/utils/groupQueries';

/** Former members banned from rejoining the group. */
export function useGroupBans() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { checkPermission } = useGroups();

  const canModerate = computed(() => checkPermission('moderate_members'));
  const query = useQuery(
    computed(() => ({
      ...groupBansQuery(groupId),
      enabled: canModerate.value,
    })),
  );
  const bannedUsers = computed<BannedMember[]>(() => query.data.value ?? []);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('groups.settings.members.errors.load_banned')),
  );

  const unban = useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/banned-users/{user_id}', {
          params: { path: { group_id: groupId, user_id: userId } },
        }),
      ),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('groups.settings.members.errors.unban')),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: groupKeys.topic(groupId, 'members'),
      }),
  });

  return {
    bannedUsers,
    loadingBannedUsers: computed(
      () => canModerate.value && query.isPending.value,
    ),
    revertBan: (userId: string) => unban.mutate(userId),
  };
}
