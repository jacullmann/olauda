import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useGroupPageId } from './useGroupPageId';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroupSettingsAccess } from './useGroupSettingsAccess';
import type { AssignableMemberRole, GroupMember } from '@/modules/groups/types';
import {
  groupKeys,
  groupMembersQuery,
} from '@/modules/groups/utils/groupQueries';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useUserStore } from '@/modules/account/stores/useUserStore';

/** The group's members, their roles and the group's ownership. */
export function useGroupMembers() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const confirmModal = useConfirmModal();
  const userStore = useUserStore();
  const { checkAuthStatus } = useSession();
  const { hasOwnerRights } = useGroupSettingsAccess();

  const query = useQuery(groupMembersQuery(groupId));
  const members = computed<GroupMember[]>(() => query.data.value ?? []);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('groups.settings.members.errors.load')),
  );

  // A change to one member also changes what may be done to the others next.
  const membersChanged = () =>
    queryClient.invalidateQueries({
      queryKey: groupKeys.topic(groupId, 'members'),
    });

  const roleChange = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: AssignableMemberRole;
    }) =>
      unwrap(
        api.PATCH('/groups/{group_id}/admin/members/{user_id}/role', {
          params: { path: { group_id: groupId, user_id: userId } },
          body: { role },
        }),
      ),
    onSuccess: (_, { userId }) =>
      userId === userStore.user?.id ? checkAuthStatus() : undefined,
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('groups.settings.members.errors.change_role')),
      ),
    onSettled: membersChanged,
  });

  const removal = useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/members/{user_id}', {
          params: {
            path: { group_id: groupId, user_id: userId },
            query: { ban },
          },
        }),
      ),
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, t('groups.settings.members.errors.remove')),
      ),
    onSuccess: membersChanged,
  });

  const mute = useMutation({
    mutationFn: ({ userId, muted }: { userId: string; muted: boolean }) => {
      const params = { path: { group_id: groupId, user_id: userId } };
      return unwrap(
        muted
          ? api.PUT('/groups/{group_id}/admin/members/{user_id}/mute', {
              params,
            })
          : api.DELETE('/groups/{group_id}/admin/members/{user_id}/mute', {
              params,
            }),
      );
    },
    onError: (error, { muted }) =>
      toast.error(
        apiErrorMessage(
          error,
          t(`groups.settings.members.errors.${muted ? 'mute' : 'unmute'}`),
        ),
      ),
    onSettled: membersChanged,
  });

  const ownershipTransfer = useMutation({
    mutationFn: (targetUserId: string) =>
      unwrap(
        api.POST('/groups/{group_id}/admin/transfer-ownership', {
          params: { path: { group_id: groupId } },
          body: { targetUserId },
        }),
      ),
    onSuccess: () => Promise.all([checkAuthStatus(), membersChanged()]),
    onError: (error) =>
      toast.error(
        apiErrorMessage(
          error,
          t('groups.settings.members.errors.transfer_ownership'),
        ),
      ),
  });

  async function changeRole(userId: string, role: AssignableMemberRole) {
    const isSelf = userId === userStore.user?.id;
    const target = members.value.find((m) => m.userId === userId);

    // Only members with the user role can be muted, so the server lifts the
    // mute along with any promotion.
    if (target?.muted && role !== 'user') {
      const isConfirmed = await confirmModal.ask({
        title: t('groups.settings.members.promote_muted_modal.title'),
        content: t('groups.settings.members.promote_muted_modal.message', {
          name: target.generatedName,
        }),
        submitText: t('groups.settings.members.promote_muted_modal.submit'),
      });
      if (!isConfirmed) return;
    }

    // Without owner rights, nobody can hand a lowered role back to themselves.
    if (isSelf && !hasOwnerRights.value) {
      const isConfirmed = await confirmModal.ask({
        title: t('groups.settings.members.step_down_modal.title'),
        content: t('groups.settings.members.step_down_modal.message'),
        submitText: t('groups.settings.members.step_down_modal.submit'),
        danger: true,
      });
      if (!isConfirmed) return;
    }

    roleChange.mutate({ userId, role });
  }

  function removeMember(userId: string, ban: boolean) {
    removal.mutate({ userId, ban });
  }

  function setMuted(userId: string, muted: boolean) {
    mute.mutate({ userId, muted });
  }

  async function transferOwnership(targetUserId: string) {
    const target = members.value.find((m) => m.userId === targetUserId);
    const owner = members.value.find((m) => m.role === 'owner');
    const selfId = userStore.user?.id;

    // Superadmins can transfer on the owner's behalf, so the text names
    // whoever actually gets demoted.
    const messageKey =
      owner?.userId === selfId
        ? 'message_as_owner'
        : targetUserId === selfId
          ? 'message_take_over'
          : 'message_on_behalf';

    const message = t(`groups.settings.members.transfer_modal.${messageKey}`, {
      name: target?.generatedName ?? '',
      owner: owner?.generatedName ?? '',
    });
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.members.transfer_modal.title'),
      content: target?.muted
        ? `${message} ${t('groups.settings.members.transfer_modal.lifts_mute')}`
        : message,
      submitText: t('groups.settings.members.transfer_modal.submit'),
      danger: true,
    });
    if (!isConfirmed) return;

    ownershipTransfer.mutate(targetUserId);
  }

  return {
    members,
    loadingMembers: query.isFetching,
    loadMembers: () => void query.refetch(),
    changeRole,
    removeMember,
    setMuted,
    transferOwnership,
  };
}
