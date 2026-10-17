import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useInvite } from '@/modules/groups/composables/useInvite';
import { useInviteModal } from '@/modules/groups/stores/useInviteModal';
import type { AdminGroup } from '@/modules/admin/types';
import { adminKeys } from '@/modules/admin/utils/adminQueries';

export type GroupAction = 'invite' | 'ban' | 'unban' | 'delete';

/** The moderation of one group; banning asks first, deleting asks for its name. */
export function useAdminGroupActions(group: Readonly<Ref<AdminGroup | null>>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const inviteModal = useInviteModal();
  const queryClient = useQueryClient();
  const { createInvite } = useInvite();
  const { t } = useI18n();

  const inviting = ref(false);
  const deleteModalOpen = ref(false);

  /** A link for a superadmin to join with, e.g. to help from inside the group. */
  async function invite() {
    const target = group.value;
    if (!target) return;

    inviting.value = true;
    try {
      const res = await createInvite(target.id);
      if (res.ok && res.token) {
        inviteModal.open({ groupId: target.id, token: res.token });
      } else {
        toast.error(res.error ?? t('groups.errors.create_invite'));
      }
    } finally {
      inviting.value = false;
    }
  }

  const ban = useMutation({
    mutationFn: ({ action, id }: { action: 'ban' | 'unban'; id: string }) => {
      const params = { params: { path: { id } } };
      return unwrap(
        action === 'ban'
          ? api.POST('/admin/groups/{id}/ban', params)
          : api.DELETE('/admin/groups/{id}/ban', params),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.groups() }),
    onError: (error, { action }) =>
      toast.error(apiErrorMessage(error, t(`admin.groups.errors.${action}`))),
  });

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
    if (confirmed) ban.mutate({ action, id: target.id });
  }

  const deletion = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/admin/groups/{id}', { params: { path: { id } } })),
    onSuccess: (_, id) => {
      // The page is left, so its group must not load again and show as gone.
      queryClient.removeQueries({ queryKey: adminKeys.group(id) });
      return Promise.all(
        [
          adminKeys.groups(),
          adminKeys.userDetails(),
          adminKeys.stats(),
          adminKeys.reports(),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });

  const pendingAction = computed<GroupAction | null>(() => {
    if (inviting.value) return 'invite';
    if (ban.isPending.value) return ban.variables.value?.action ?? null;
    if (deletion.isPending.value) return 'delete';
    return null;
  });

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

    try {
      await deletion.mutateAsync(target.id);
      deleteModalOpen.value = false;
      // The page is left, so the user no longer sees the group go.
      toast.success(t('admin.groups.success.delete'));
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, t('groups.errors.delete')));
      return false;
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
