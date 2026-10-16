import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import api from '@/api/client';
import { apiErrorStatus } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type {
  MemberRole,
  AdminMembership,
  AdminUser,
} from '@/modules/admin/types';

const NOT_FOUND = 404;

export type UserDetailsState = 'loading' | 'ready' | 'not-found' | 'failed';

/** An account with its groups, as its admin page shows it. */
export function useAdminUser(userId: MaybeRefOrGetter<string>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const { t } = useI18n();

  const user = ref<AdminUser | null>(null);
  const memberships = ref<AdminMembership[]>([]);
  const state = ref<UserDetailsState>('loading');
  const changingGroupId = ref<string | null>(null);

  let controller: AbortController | null = null;

  async function load() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    const id = toValue(userId);
    const config = { signal: current.signal };
    state.value = 'loading';

    try {
      const [userRes, groupsRes] = await Promise.all([
        api.get<AdminUser>(`/admin/users/${id}`, config),
        api.get<AdminMembership[]>(`/admin/users/${id}/groups`, config),
      ]);
      user.value = userRes.data;
      memberships.value = groupsRes.data;
      state.value = 'ready';
    } catch (error) {
      if (axios.isCancel(error)) return;
      state.value =
        apiErrorStatus(error) === NOT_FOUND ? 'not-found' : 'failed';
    }
  }

  async function changeRole(membership: AdminMembership, role: MemberRole) {
    const id = toValue(userId);
    if (role === membership.role) return;

    // Only members with the user role can be muted, so the server lifts the
    // mute along with any promotion.
    if (membership.muted && role !== 'user') {
      const isConfirmed = await confirmModal.ask({
        title: t('admin.users.promote_muted_modal.title'),
        content: t('admin.users.promote_muted_modal.message', {
          group: membership.groupName,
        }),
        submitText: t('admin.users.promote_muted_modal.submit'),
      });
      if (!isConfirmed) return;
    }

    changingGroupId.value = membership.groupId;
    try {
      await api.patch(`/admin/users/${id}/groups/${membership.groupId}/role`, {
        role,
      });
      // Transferring ownership also changes the previous owner, and the
      // assignable roles follow the new role, so the server stays the source.
      const { data } = await api.get<AdminMembership[]>(
        `/admin/users/${id}/groups`,
      );
      if (toValue(userId) === id) memberships.value = data;
    } catch {
      toast.error(t('admin.users.errors.change_role'));
    } finally {
      changingGroupId.value = null;
    }
  }

  // Another account's details must never show, not even dimmed while loading.
  watch(
    () => toValue(userId),
    () => {
      user.value = null;
      memberships.value = [];
      void load();
    },
    { immediate: true },
  );

  return {
    user,
    memberships,
    state,
    reload: load,
    changingGroupId,
    changeRole,
  };
}
