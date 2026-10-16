import { ref, computed } from 'vue';
import type { RouteLocationNamedRaw } from 'vue-router';
import api from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import { groupPath } from '@/api/groupPath';
import i18n from '@/i18n';
import { useSession } from '@/modules/auth/composables/useSession';
import type { ScheduleConfig } from '@/modules/schedule/types';
import {
  toCourseSetup,
  toGroupType,
  type CourseSetup,
  type GroupType,
  type PermissionKey,
  type PermissionMatrix,
} from '@/modules/groups/types';

export type UserGroup = {
  id: string;
  name: string;
  role: string;
  ownerId: string;
  scheduleConfig?: ScheduleConfig;
  avatarUrl?: string | null;
  permissions: PermissionMatrix;
  groupType: GroupType;
  daltonEnabled: boolean;
  effectivePermissions: PermissionKey[];
  courseSetup: CourseSetup;
  /** A superadmin banned the group: members cannot open it until it is lifted. */
  banned: boolean;
  /** A moderator muted the user: they can read the group but change nothing. */
  muted: boolean;
};

/** A group as the API sends it, before unknown values are normalized. */
export type RawGroup = Omit<
  UserGroup,
  'groupType' | 'effectivePermissions' | 'courseSetup' | 'banned' | 'muted'
> & {
  groupType?: string;
  effectivePermissions?: string[];
  courseSetup?: string;
  banned?: boolean;
  muted?: boolean;
};

const userGroups = ref<UserGroup[]>([]);
const landingGroupId = ref<string | null>(null);

/**
 * The group the current route shows. It is per tab and derived from the URL
 * by the router, so two tabs on different groups never interfere.
 */
const activeGroupId = ref<string | null>(null);

/** The last group this tab showed, kept while visiting non-group pages. */
const recentGroupId = ref<string | null>(null);

/** A group a superadmin opened without being a member of it. */
const foreignGroup = ref<UserGroup | null>(null);

const PERMISSION_KEYS: readonly string[] = [
  'edit_group_profile',
  'edit_group_configuration',
  'edit_subjects_courses',
  'edit_schedule',
  'create_items',
  'upload_images',
  'manage_notes',
  'manage_schedule_changes',
  'manage_announcements',
  'moderate_members',
  'edit_other_content',
  'delete_other_content',
  'invite_members',
] satisfies PermissionKey[];

function isPermissionKey(s: string): s is PermissionKey {
  return PERMISSION_KEYS.includes(s);
}

function toUserGroup(raw: RawGroup): UserGroup {
  return {
    ...raw,
    groupType: toGroupType(raw.groupType),
    daltonEnabled: raw.daltonEnabled === true,
    effectivePermissions: (raw.effectivePermissions ?? []).filter(
      isPermissionKey,
    ),
    courseSetup: toCourseSetup(raw.courseSetup),
    banned: raw.banned === true,
    muted: raw.muted === true,
  };
}

/** Takes the user's groups from the session status. */
export function applyGroupStatus(
  groups: RawGroup[],
  landing: string | null,
): void {
  userGroups.value = groups.map(toUserGroup);
  landingGroupId.value = landing;
}

/** Forgets every group once the session ends. */
export function clearGroups(): void {
  userGroups.value = [];
  landingGroupId.value = null;
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

/** Mirrors a ban the server reported on a request, e.g. one placed mid-session. */
export function markGroupBanned(groupId: string): void {
  const group = findGroup(groupId);
  if (group) group.banned = true;
}

/** Mirrors a mute the server reported on a request, which takes every permission. */
export function markGroupMuted(groupId: string): void {
  const group = findGroup(groupId);
  if (!group) return;
  group.muted = true;
  group.effectivePermissions = [];
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
      const { data } = await api.get<RawGroup>(groupPath(groupId));
      foreignGroup.value = toUserGroup(data);
      return true;
    } catch {
      return false;
    }
  }

  /** Mirrors a course setup the server just saved or reset. */
  function setCourseSetup(groupId: string, courseSetup: CourseSetup): void {
    const group = findGroup(groupId);
    if (group) group.courseSetup = courseSetup;
  }

  /** Called once a navigation is confirmed, with the group its URL names. */
  function showGroup(groupId: string | null): void {
    if (groupId === activeGroupId.value) return;
    activeGroupId.value = groupId;
    if (!groupId) return;

    recentGroupId.value = groupId;
    api.post(groupPath(groupId, '/visit')).catch(() => {
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
      const { data } = await api.post<{ ok: boolean; groupId: string }>(
        '/groups',
        { groupName: name, avatarId, groupType, daltonEnabled },
      );
      await useSession().checkAuthStatus();
      return { ok: true, groupId: data.groupId };
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
