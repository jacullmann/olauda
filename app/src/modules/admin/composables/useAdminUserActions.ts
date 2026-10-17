import { computed, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { AdminUser } from '@/modules/admin/types';
import { adminKeys } from '@/modules/admin/utils/adminQueries';

export type UserAction = 'ban' | 'unban' | 'reset_mfa' | 'delete';

function request(action: UserAction, id: string): Promise<unknown> {
  const params = { params: { path: { id } } };
  switch (action) {
    case 'ban':
      return unwrap(api.POST('/admin/users/{id}/ban', params));
    case 'unban':
      return unwrap(api.DELETE('/admin/users/{id}/ban', params));
    case 'reset_mfa':
      return unwrap(api.DELETE('/admin/users/{id}/mfa', params));
    case 'delete':
      return unwrap(api.DELETE('/admin/users/{id}', params));
  }
}

/** The moderation of one account, each step confirmed before it is taken. */
export function useAdminUserActions(user: Readonly<Ref<AdminUser | null>>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const invalidate = (...keys: readonly (readonly unknown[])[]) =>
    Promise.all(
      keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );

  const moderation = useMutation({
    mutationFn: ({
      action,
      target,
    }: {
      action: UserAction;
      target: AdminUser;
    }) => request(action, target.id),
    onSuccess: (_, { action, target }) => {
      if (action !== 'delete') {
        return invalidate(adminKeys.users(), adminKeys.stats());
      }
      // The page is left, so its account must not load again and show as gone.
      queryClient.removeQueries({ queryKey: adminKeys.user(target.id) });
      return invalidate(
        adminKeys.users(),
        adminKeys.groups(),
        adminKeys.stats(),
        adminKeys.reports(),
      );
    },
  });

  const pendingAction = computed<UserAction | null>(() =>
    moderation.isPending.value
      ? (moderation.variables.value?.action ?? null)
      : null,
  );

  /** Asks, then runs the action; resolves whether it was carried out. */
  async function perform(
    action: UserAction,
    target: AdminUser,
    options: { submitText: string; danger: boolean; errorKey: string },
  ): Promise<boolean> {
    const confirmed = await confirmModal.ask({
      title: t(`admin.users.${action}_modal.title`),
      content: t(`admin.users.${action}_modal.content`, {
        email: target.email,
      }),
      submitText: options.submitText,
      danger: options.danger,
    });
    if (!confirmed) return false;

    try {
      await moderation.mutateAsync({ action, target });
      return true;
    } catch (error) {
      toast.error(apiErrorMessage(error, t(options.errorKey)));
      return false;
    }
  }

  async function toggleBan() {
    const target = user.value;
    if (!target || target.isSuperadmin) return;

    const action = target.isBanned ? 'unban' : 'ban';
    await perform(action, target, {
      submitText: t(`admin.users.actions.${action}`),
      danger: action === 'ban',
      errorKey: `admin.users.errors.${action}`,
    });
  }

  /** Support for a user who lost their authenticator and recovery codes. */
  async function resetMfa() {
    const target = user.value;
    if (!target?.mfaEnabled) return;

    await perform('reset_mfa', target, {
      submitText: t('admin.users.actions.reset_mfa'),
      danger: true,
      errorKey: 'admin.users.errors.reset_mfa',
    });
  }

  /** Resolves whether the account is gone, so its page can be left. */
  async function deleteUser(): Promise<boolean> {
    const target = user.value;
    if (!target || target.isSuperadmin) return false;

    const done = await perform('delete', target, {
      submitText: t('common.buttons.delete'),
      danger: true,
      errorKey: 'admin.users.errors.delete',
    });
    // The page is left, so the user no longer sees the account go.
    if (done) toast.success(t('admin.users.success.delete'));
    return done;
  }

  return { pendingAction, toggleBan, resetMfa, deleteUser };
}
