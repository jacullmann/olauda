import { ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import type { SuperAdminUser } from '../types';
import { useSuperAdminStats } from './useSuperAdminStats';

export type UserAction = 'ban' | 'unban' | 'reset_mfa' | 'delete';

/** The moderation of one account, each step confirmed before it is taken. */
export function useSuperAdminUserActions(user: Ref<SuperAdminUser | null>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { t } = useI18n();
  const { loadStats } = useSuperAdminStats();

  const pendingAction = ref<UserAction | null>(null);

  /** Asks, then runs the request; resolves whether it was carried out. */
  async function perform(
    action: UserAction,
    target: SuperAdminUser,
    options: { submitText: string; danger: boolean; errorKey: string },
    request: () => Promise<unknown>,
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

    pendingAction.value = action;
    try {
      await request();
      return true;
    } catch {
      toast.error(t(options.errorKey));
      return false;
    } finally {
      pendingAction.value = null;
    }
  }

  async function toggleBan() {
    const target = user.value;
    if (!target || target.isSuperadmin) return;

    const action = target.isBanned ? 'unban' : 'ban';
    const done = await perform(
      action,
      target,
      {
        submitText: t(`admin.users.actions.${action}`),
        danger: action === 'ban',
        errorKey: `admin.users.errors.${action}`,
      },
      () =>
        action === 'ban'
          ? api.post(`/admin/users/${target.id}/ban`)
          : api.delete(`/admin/users/${target.id}/ban`),
    );
    if (!done) return;

    target.isBanned = action === 'ban';
    await loadStats();
  }

  /** Support for a user who lost their authenticator and recovery codes. */
  async function resetMfa() {
    const target = user.value;
    if (!target?.mfaEnabled) return;

    const done = await perform(
      'reset_mfa',
      target,
      {
        submitText: t('admin.users.actions.reset_mfa'),
        danger: true,
        errorKey: 'admin.users.errors.reset_mfa',
      },
      () => api.delete(`/admin/users/${target.id}/mfa`),
    );
    if (done) target.mfaEnabled = false;
  }

  /** Resolves whether the account is gone, so its page can be left. */
  async function deleteUser(): Promise<boolean> {
    const target = user.value;
    if (!target || target.isSuperadmin) return false;

    const done = await perform(
      'delete',
      target,
      {
        submitText: t('common.buttons.delete'),
        danger: true,
        errorKey: 'admin.users.errors.delete',
      },
      () => api.delete(`/admin/users/${target.id}`),
    );
    if (!done) return false;
    // The page is left, so the user no longer sees the account go.
    toast.success(t('admin.users.success.delete'));
    await loadStats();
    return true;
  }

  return { pendingAction, toggleBan, resetMfa, deleteUser };
}
