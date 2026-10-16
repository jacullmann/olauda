import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from './useGroupPageId';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroupSettingsAccess } from './useGroupSettingsAccess';
import type { AssignableMemberRole, GroupMember } from '@/modules/groups/types';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useUserStore } from '@/modules/account/stores/useUserStore';

/** The group's members, their roles and the group's ownership. */
export function useGroupMembers() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const userStore = useUserStore();
  const { checkAuthStatus } = useSession();
  const { hasOwnerRights } = useGroupSettingsAccess();

  const members = ref<GroupMember[]>([]);
  const loadingMembers = ref(false);

  async function loadMembers() {
    loadingMembers.value = true;
    try {
      const { data } = await api.get<GroupMember[]>(
        groupPath(groupId, '/members'),
      );
      members.value = data;
    } catch {
      toast.error(t('groups.settings.members.errors.load'));
    } finally {
      loadingMembers.value = false;
    }
  }

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

    try {
      await api.patch(groupPath(groupId, `/admin/members/${userId}/role`), {
        role,
      });
      // A role change also changes what may be done to that member next.
      await Promise.all([isSelf && checkAuthStatus(), loadMembers()]);
    } catch (e) {
      toast.error(
        apiErrorMessage(e, t('groups.settings.members.errors.change_role')),
      );
      await loadMembers();
    }
  }

  async function removeMember(userId: string, ban: boolean) {
    try {
      await api.delete(groupPath(groupId, `/admin/members/${userId}`), {
        params: { ban },
      });
      members.value = members.value.filter((m) => m.userId !== userId);
    } catch (e) {
      toast.error(
        apiErrorMessage(e, t('groups.settings.members.errors.remove')),
      );
    }
  }

  async function setMuted(userId: string, muted: boolean) {
    try {
      const path = groupPath(groupId, `/admin/members/${userId}/mute`);
      await (muted ? api.put(path) : api.delete(path));
      members.value = members.value.map((m) =>
        m.userId === userId ? { ...m, muted } : m,
      );
    } catch (e) {
      const errorKey = muted ? 'mute' : 'unmute';
      toast.error(
        apiErrorMessage(e, t(`groups.settings.members.errors.${errorKey}`)),
      );
      await loadMembers();
    }
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

    try {
      await api.post(groupPath(groupId, '/admin/transfer-ownership'), {
        targetUserId,
      });
      await Promise.all([checkAuthStatus(), loadMembers()]);
    } catch (e) {
      toast.error(
        apiErrorMessage(
          e,
          t('groups.settings.members.errors.transfer_ownership'),
        ),
      );
    }
  }

  onMounted(loadMembers);

  return {
    members,
    loadingMembers,
    loadMembers,
    changeRole,
    removeMember,
    setMuted,
    transferOwnership,
  };
}
