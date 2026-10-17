import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useGroupPageId } from './useGroupPageId';
import { useGroups } from './useGroups';
import type { GroupInviteLog } from '@/modules/groups/types';
import {
  groupInvitesQuery,
  groupKeys,
} from '@/modules/groups/utils/groupQueries';

/** The group's invite links, used, revoked and still open. */
export function useGroupInvites() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { checkPermission } = useGroups();

  const canModerate = computed(() => checkPermission('moderate_members'));
  const query = useQuery(
    computed(() => ({
      ...groupInvitesQuery(groupId),
      enabled: canModerate.value,
    })),
  );
  const invites = computed<GroupInviteLog[]>(() => query.data.value ?? []);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('groups.settings.members.errors.load_invites')),
  );

  const revoke = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/invites/{id}', {
          params: { path: { group_id: groupId, id } },
        }),
      ),
    onError: (error) =>
      toast.error(
        apiErrorMessage(
          error,
          t('groups.settings.members.errors.revoke_invite'),
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: groupKeys.topic(groupId, 'members'),
      }),
  });

  return {
    invites,
    loadingInvites: computed(() => canModerate.value && query.isPending.value),
    revokeInvite: (id: string) => revoke.mutate(id),
  };
}
