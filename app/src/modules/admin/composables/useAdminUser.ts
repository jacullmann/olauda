import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage, apiErrorStatus } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import type { MemberRole, AdminMembership } from '@/modules/admin/types';
import {
  adminKeys,
  adminUserMembershipsQuery,
  adminUserQuery,
} from '@/modules/admin/utils/adminQueries';

const NOT_FOUND = 404;

export type UserDetailsState = 'loading' | 'ready' | 'not-found' | 'failed';

/**
 * An account with its groups, as its admin page shows it. Another account's
 * details never show, not even dimmed while loading, as each account has its
 * own queries.
 */
export function useAdminUser(userId: MaybeRefOrGetter<string>) {
  const toast = useToast();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const userQuery = useQuery(computed(() => adminUserQuery(toValue(userId))));
  const membershipsQuery = useQuery(
    computed(() => adminUserMembershipsQuery(toValue(userId))),
  );

  const user = computed(() => userQuery.data.value ?? null);
  const memberships = computed(() => membershipsQuery.data.value ?? []);

  const state = computed<UserDetailsState>(() => {
    if (user.value && membershipsQuery.data.value) return 'ready';
    if (userQuery.isFetching.value || membershipsQuery.isFetching.value) {
      return 'loading';
    }
    const error = userQuery.error.value ?? membershipsQuery.error.value;
    if (!error) return 'loading';
    return apiErrorStatus(error) === NOT_FOUND ? 'not-found' : 'failed';
  });

  function reload() {
    void userQuery.refetch();
    void membershipsQuery.refetch();
  }

  const roleChange = useMutation({
    mutationFn: ({
      userId: id,
      membership,
      role,
    }: {
      userId: string;
      membership: AdminMembership;
      role: MemberRole;
    }) =>
      unwrap(
        api.PATCH('/admin/users/{id}/groups/{group_id}/role', {
          params: { path: { id, group_id: membership.groupId } },
          body: { role },
        }),
      ),
    // Transferring ownership also changes the previous owner, and the
    // assignable roles follow the new role, so the server stays the source.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.userDetails() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.groups() }),
      ]),
    onError: (error) =>
      toast.error(apiErrorMessage(error, t('admin.users.errors.change_role'))),
  });

  const changingGroupId = computed(() =>
    roleChange.isPending.value
      ? (roleChange.variables.value?.membership.groupId ?? null)
      : null,
  );

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

    roleChange.mutate({ userId: id, membership, role });
  }

  return {
    user,
    memberships,
    state,
    reload,
    changingGroupId,
    changeRole,
  };
}
