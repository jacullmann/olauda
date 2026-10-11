import { useRouter } from 'vue-router';
import { useGroups } from './useGroups';
import type { PermissionKey } from '@/modules/groups/types';

/**
 * Runs a group-bound action from anywhere in the app. Outside a group page it
 * targets the group this tab showed last; the action receives that group
 * explicitly and never relies on an ambient "current group". An action that
 * needs a `permission` falls back to the first group granting it.
 */
export function useGroupAction() {
  const router = useRouter();
  const { contextGroupId, userGroups, findGroup } = useGroups();

  function targetGroupId(permission?: PermissionKey): string | null {
    if (!permission) return contextGroupId.value;
    const grants = (groupId: string | null) =>
      !!findGroup(groupId)?.effectivePermissions.includes(permission);
    if (grants(contextGroupId.value)) return contextGroupId.value;
    return userGroups.value.find((group) => grants(group.id))?.id ?? null;
  }

  const withGroup = (
    action: (groupId: string) => void,
    permission?: PermissionKey,
  ) => {
    const groupId = targetGroupId(permission);
    if (groupId) {
      action(groupId);
    } else {
      void router.push({ name: 'groups' });
    }
  };

  return { withGroup };
}
