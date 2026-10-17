import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useInviteModal } from '@/modules/groups/stores/useInviteModal';
import { useToast } from '@/common/composables/useToast';
import { useSession } from '@/modules/auth/composables/useSession';
import { type UserGroup } from './useGroups';
import { useInvite } from './useInvite';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

/** The per-group actions offered by the header's group menu and the groups list. */
export function useGroupMenuActions() {
  const { t } = useI18n();
  const router = useRouter();
  const confirmModal = useConfirmModal();
  const inviteModal = useInviteModal();
  const toast = useToast();
  const { user } = storeToRefs(useUserStore());
  const { createInvite } = useInvite();
  const { checkAuthStatus } = useSession();
  const queryClient = useQueryClient();

  const pending = ref(false);

  function canInviteMembers(group: UserGroup): boolean {
    return group.effectivePermissions.includes('invite_members');
  }

  async function inviteMember(groupId: string) {
    pending.value = true;
    try {
      const res = await createInvite(groupId);
      if (res.ok && res.token) {
        inviteModal.open({ groupId: groupId, token: res.token });
      } else {
        toast.error(res.error || t('groups.errors.create_invite'));
      }
    } catch (err) {
      console.error('Failed to generate invite link:', err);
      toast.error(t('groups.errors.create_invite'));
    } finally {
      pending.value = false;
    }
  }

  function openGroupSettings(groupId: string) {
    void router.push({ name: 'group-admin', params: { groupId } });
  }

  async function leaveGroup(group: {
    id: string;
    name: string;
    ownerId: string | null;
  }) {
    if (group.ownerId === user.value?.id) {
      toast.error(t('groups.errors.owner_cannot_leave'));
      return;
    }

    const isConfirmed = await confirmModal.ask({
      title: t('common.header.leave_group_confirm.title'),
      content: t('common.header.leave_group_confirm.content', {
        group: group.name,
      }),
      submitText: t('common.header.leave_group_confirm.submit'),
      danger: true,
    });
    if (!isConfirmed) return;

    pending.value = true;
    try {
      await unwrap(
        api.DELETE('/groups/{group_id}/leave', {
          params: { path: { group_id: group.id } },
        }),
      );
      await checkAuthStatus();
      await router.push({ name: 'groups' });
      queryClient.removeQueries({ queryKey: groupKeys.group(group.id) });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('groups.errors.leave')));
    } finally {
      pending.value = false;
    }
  }

  return {
    pending,
    canInviteMembers,
    inviteMember,
    openGroupSettings,
    leaveGroup,
  };
}
