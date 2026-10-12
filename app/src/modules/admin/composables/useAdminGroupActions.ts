import { ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useInvite } from '@/modules/groups/composables/useInvite';
import { useInviteModal } from '@/modules/groups/stores/useInviteModal';
import type { AdminGroup } from '@/modules/admin/types';

export type GroupAction = 'invite' | 'ban' | 'unban' | 'delete';

/** The moderation of one group; banning asks first, deleting asks for its name. */
export function useAdminGroupActions(group: Ref<AdminGroup | null>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const inviteModal = useInviteModal();
  const { createInvite } = useInvite();
  const { t } = useI18n();

  const pendingAction = ref<GroupAction | null>(null);
  const deleteModalOpen = ref(false);

  /** A link for a superadmin to join with, e.g. to help from inside the group. */
  async function invite() {
    const target = group.value;
    if (!target) return;

    pendingAction.value = 'invite';
    try {
      const res = await createInvite(target.id);
      if (res.ok && res.token) {
        inviteModal.open({ groupId: target.id, token: res.token });
      } else {
        toast.error(res.error ?? t('groups.errors.create_invite'));
      }
    } finally {
      pendingAction.value = null;
    }
  }

  async function toggleBan() {
    const target = group.value;
    if (!target) return;

    const action = target.bannedAt ? 'unban' : 'ban';
    const confirmed = await confirmModal.ask({
      title: t(`admin.groups.${action}_modal.title`),
      content: t(`admin.groups.${action}_modal.content`, {
        name: target.name,
      }),
      submitText: t(`admin.groups.actions.${action}`),
      danger: action === 'ban',
    });
    if (!confirmed) return;

    pendingAction.value = action;
    try {
      const { data } = await (action === 'ban'
        ? api.post<{ bannedAt: string | null }>(
            `/admin/groups/${target.id}/ban`,
          )
        : api.delete<{ bannedAt: string | null }>(
            `/admin/groups/${target.id}/ban`,
          ));
      target.bannedAt = data.bannedAt;
    } catch {
      toast.error(t(`admin.groups.errors.${action}`));
    } finally {
      pendingAction.value = null;
    }
  }

  function requestDelete() {
    deleteModalOpen.value = true;
  }

  function cancelDelete() {
    deleteModalOpen.value = false;
  }

  /** Resolves whether the group is gone, so its page can be left. */
  async function confirmDelete(): Promise<boolean> {
    const target = group.value;
    if (!target) return false;

    pendingAction.value = 'delete';
    try {
      await api.delete(`/admin/groups/${target.id}`);
      deleteModalOpen.value = false;
      // The page is left, so the user no longer sees the group go.
      toast.success(t('admin.groups.success.delete'));
      return true;
    } catch {
      toast.error(t('groups.errors.delete'));
      return false;
    } finally {
      pendingAction.value = null;
    }
  }

  return {
    pendingAction,
    invite,
    toggleBan,
    deleteModalOpen,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
