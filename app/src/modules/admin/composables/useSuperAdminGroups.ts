import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { useToast } from '@/common/composables/useToast';
import { useInviteModal } from '@/stores/modalStore';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import type {
  GroupSort,
  GroupTypeFilter,
  SortOrder,
  SuperAdminGroup,
} from '../types';
import { useWindowedList } from './useWindowedList';

export const GROUP_TYPE_FILTERS = [
  'all',
  'regular',
  'abitur',
] as const satisfies readonly GroupTypeFilter[];

const GROUP_SORTS = [
  'createdAt',
  'name',
  'memberCount',
  'itemCount',
] as const satisfies readonly GroupSort[];

const SORT_ORDERS = ['asc', 'desc'] as const satisfies readonly SortOrder[];

export function useSuperAdminGroups() {
  const toast = useToast();
  const inviteModal = useInviteModal();
  const { createInvite } = useAppAuth();
  const { t } = useI18n();

  const list = useWindowedList<
    SuperAdminGroup,
    {
      search: string;
      type: GroupTypeFilter;
      sort: GroupSort;
      order: SortOrder;
    }
  >({
    endpoint: '/admin/groups',
    defaults: { search: '', type: 'all', sort: 'createdAt', order: 'desc' },
    rules: {
      type: GROUP_TYPE_FILTERS,
      sort: GROUP_SORTS,
      order: SORT_ORDERS,
    },
    ascendingSorts: ['name'],
    onError: () => toast.error(t('admin.groups.errors.load')),
  });

  const invitingGroupId = ref<string | null>(null);

  async function inviteToGroup(group: SuperAdminGroup) {
    invitingGroupId.value = group.id;
    try {
      const res = await createInvite(group.id);
      if (res.ok && res.token) {
        inviteModal.open({ groupId: group.id, token: res.token });
      } else {
        toast.error(res.error ?? t('groups.errors.create_invite'));
      }
    } finally {
      invitingGroupId.value = null;
    }
  }

  // Kept after closing so the modal still names the group while it animates out.
  const groupPendingDelete = ref<SuperAdminGroup | null>(null);
  const deleteModalOpen = ref(false);
  const deletingGroup = ref(false);

  function requestDeleteGroup(group: SuperAdminGroup) {
    groupPendingDelete.value = group;
    deleteModalOpen.value = true;
  }

  function cancelDeleteGroup() {
    deleteModalOpen.value = false;
  }

  async function confirmDeleteGroup() {
    const group = groupPendingDelete.value;
    if (!group) return;

    deletingGroup.value = true;
    try {
      await api.delete(`/admin/groups/${group.id}`);
      toast.success(t('admin.groups.delete_success', { name: group.name }));
      deleteModalOpen.value = false;
      list.refresh();
    } catch {
      toast.error(t('groups.errors.delete'));
    } finally {
      deletingGroup.value = false;
    }
  }

  return {
    ...list,
    invitingGroupId,
    inviteToGroup,
    groupPendingDelete,
    deleteModalOpen,
    deletingGroup,
    requestDeleteGroup,
    cancelDeleteGroup,
    confirmDeleteGroup,
  };
}
