import { computed } from 'vue';
import { useGroups } from './useGroups';
import { useUserStore } from '@/modules/account/stores/useUserStore';

export function useGroupSettingsAccess() {
  const { activeGroupOwnerId } = useGroups();
  const userStore = useUserStore();

  const isOwner = computed(
    () =>
      !!userStore.user?.id && activeGroupOwnerId.value === userStore.user.id,
  );
  // Superadmins act with the owner's rights in every group, mirroring the
  // backend's `TenantContext::has_owner_rights`.
  const hasOwnerRights = computed(
    () => isOwner.value || userStore.isSuperadmin,
  );

  return { hasOwnerRights };
}
