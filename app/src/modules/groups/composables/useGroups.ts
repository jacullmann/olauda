import { ref, computed } from 'vue';
import type { RouteLocationNamedRaw } from 'vue-router';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { queryClient } from '@/api/queryClient';
import i18n from '@/i18n';
import {
  sessionStatus,
  useSession,
} from '@/modules/auth/composables/useSession';
import { sessionKey } from '@/modules/auth/utils/sessionQueries';
import { groupSummaryQuery } from '@/modules/groups/utils/groupQueries';
import type {
  CourseSetup,
  GroupType,
  PermissionKey,
  UserGroup,
} from '@/modules/groups/types';
import type { GroupStatusDto } from '@/api/schema';

export type { UserGroup };

const userGroups = computed(() => sessionStatus.value?.groups ?? []);
const landingGroupId = computed(
  () => sessionStatus.value?.landingGroupId ?? null,
);

/**
 * The group the current route shows. It is per tab and derived from the URL
 * by the router, so two tabs on different groups never interfere.
 */
const activeGroupId = ref<string | null>(null);

/** The last group this tab showed, kept while visiting non-group pages. */
const recentGroupId = ref<string | null>(null);

/** A group a superadmin opened without being a member of it. */
const foreignGroup = ref<UserGroup | null>(null);

/** Forgets the groups this tab showed once the session ends. */
export function clearGroups(): void {
  activeGroupId.value = null;
  recentGroupId.value = null;
  foreignGroup.value = null;
}

function findGroup(groupId: string | null): UserGroup | null {
  if (!groupId) return null;
  return (
    userGroups.value.find((g) => g.id === groupId) ??
    (foreignGroup.value?.id === groupId ? foreignGroup.value : null)
  );
}

/** Changes the cached copy of one of the user's groups. */
function updateGroup(groupId: string, change: Partial<UserGroup>): void {
  queryClient.setQueryData<GroupStatusDto>(
    sessionKey,
    (status) =>
      status && {
        ...status,
        groups: status.groups.map((group) =>
          group.id === groupId ? { ...group, ...change } : group,
        ),
      },
  );
  if (foreignGroup.value?.id === groupId) {
    foreignGroup.value = { ...foreignGroup.value, ...change };
  }
}

/** Mirrors a ban the server reported on a request, e.g. one placed mid-session. */
export function markGroupBanned(groupId: string): void {
  updateGroup(groupId, { banned: true });
}

/** Mirrors a mute the server reported on a request, which takes every permission. */
export function markGroupMuted(groupId: string): void {
  updateGroup(groupId, { muted: true, effectivePermissions: [] });
}

const activeGroup = computed(() => findGroup(activeGroupId.value));

/**
 * The group an action started outside a group page defaults to: the one on
 * screen, else the one this tab showed last, else where the user landed.
 */
const contextGroupId = computed<string | null>(() => {
  const candidates = [
    activeGroupId.value,
    recentGroupId.value,
    landingGroupId.value,
  ];
  return (
    candidates.find((id) => findGroup(id) !== null) ??
    userGroups.value[0]?.id ??
    null
  );
});

/** Where to go when nothing more specific applies, e.g. after sign-in. */
const homeRoute = computed<RouteLocationNamedRaw>(() =>
  contextGroupId.value
    ? { name: 'group-dashboard', params: { groupId: contextGroupId.value } }
    : { name: 'groups' },
);

const groupName = computed(() => activeGroup.value?.name ?? null);
const activeGroupOwnerId = computed(() => activeGroup.value?.ownerId ?? null);
const activeGroupAvatarUrl = computed(
  () => activeGroup.value?.avatarUrl ?? null,
);
const activeGroupPermissions = computed(
  () => activeGroup.value?.permissions ?? null,
);
const activeGroupType = computed<GroupType>(
  () => activeGroup.value?.groupType ?? 'regular',
);
const activeGroupDaltonEnabled = computed(
  () => activeGroup.value?.daltonEnabled === true,
);
const activeScheduleConfig = computed(
  () => activeGroup.value?.scheduleConfig ?? null,
);
const activePermissions = computed(
  () => new Set<PermissionKey>(activeGroup.value?.effectivePermissions ?? []),
);

/** The groups the user belongs to and the one the current route shows. */
export function useGroups() {
  /**
   * Whether this tab may show `groupId`. Membership is the server's call: a
   * group missing from the list is only reachable for a superadmin, and the
   * server answers 404 to anyone else.
   */
  async function canShowGroup(groupId: string): Promise<boolean> {
    if (findGroup(groupId)) return true;
    try {
      foreignGroup.value = await queryClient.fetchQuery(
        groupSummaryQuery(groupId),
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Mirrors a course setup the server just saved or reset. */
  function setCourseSetup(groupId: string, courseSetup: CourseSetup): void {
    updateGroup(groupId, { courseSetup });
  }

  /** Called once a navigation is confirmed, with the group its URL names. */
  function showGroup(groupId: string | null): void {
    if (groupId === activeGroupId.value) return;
    activeGroupId.value = groupId;
    if (!groupId) return;

    recentGroupId.value = groupId;
    unwrap(
      api.POST('/groups/{group_id}/visit', {
        params: { path: { group_id: groupId } },
      }),
    ).catch(() => {
      // Only the next sign-in's landing page depends on it.
    });
  }

  async function createGroup(
    name: string,
    /** An upload from `uploadGroupAvatar`. */
    avatarId?: string,
    groupType: GroupType = 'regular',
    daltonEnabled = false,
  ): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
    try {
      const { id } = await unwrap(
        api.POST('/groups', {
          body: { groupName: name, avatarId, groupType, daltonEnabled },
        }),
      );
      await useSession().checkAuthStatus();
      return { ok: true, groupId: id };
    } catch (error: unknown) {
      return {
        ok: false,
        error: apiErrorMessage(error, i18n.global.t('groups.errors.create')),
      };
    }
  }

  /** Mirrors the server's verdict for the group on screen; the server still enforces it. */
  function checkPermission(permissionKey: PermissionKey): boolean {
    return activePermissions.value.has(permissionKey);
  }

  function canInAnyGroup(permissionKey: PermissionKey): boolean {
    return userGroups.value.some((group) =>
      group.effectivePermissions.includes(permissionKey),
    );
  }

  return {
    groupName,
    activeGroupId,
    contextGroupId,
    homeRoute,
    activeGroup,
    activeGroupOwnerId,
    activeGroupAvatarUrl,
    activeGroupPermissions,
    activeGroupType,
    activeGroupDaltonEnabled,
    activePermissions,
    activeScheduleConfig,
    userGroups,
    findGroup,
    canInAnyGroup,
    canShowGroup,
    showGroup,
    setCourseSetup,
    createGroup,
    checkPermission,
  };
}
