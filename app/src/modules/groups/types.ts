import type { CourseType } from '@/modules/courses/types';

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'user';

/** The roles that can be assigned directly; ownership is only transferred. */
export type AssignableMemberRole = Exclude<MemberRole, 'owner'>;

export interface GroupMember {
  userId: string;
  generatedName: string;
  role: MemberRole;
  joinedAt: string;
  /** Roles the current user may move this member to, decided by the server. */
  assignableRoles: MemberRole[];
  /** Whether the current user may remove this member, decided by the server. */
  canRemove: boolean;
}

export interface ScheduleSubstitution {
  id: string;
  lessonId: string;
  /** The Monday of the one week the change applies to, as YYYY-MM-DD. */
  weekStart: string;
  courseId?: string | null;
  day?: string;
  slot?: number;
  duration?: number;
  subject?: string;
  teacher?: string | null;
  room?: string | null;
  cancelled?: boolean;
  createdAt?: string;
}

export interface AdminCourse {
  id: string;
  name: string;
  /** GK/LK/ZK in an Abitur group, absent everywhere else. */
  courseType?: CourseType | null;
}

export interface AdminSubject {
  id: string;
  name: string;
  category?: string;
  /** Offered for Dalton tasks; always set on the whole subject. */
  isDalton?: boolean;
  courses?: AdminCourse[];
}

export interface GroupInviteLog {
  id: string;
  /** Only present while the invite can still be used. */
  token: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  usedByName: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedByName: string | null;
}

export interface BannedMember {
  userId: string;
  generatedName: string;
  bannedAt: string;
}

/**
 * A regular group is a class that attends every lesson together. An Abitur
 * group is a whole year: every subject is course-based and each course is
 * scheduled on its own, so two courses of the same subject can run on
 * different days.
 */
export type GroupType = 'regular' | 'abitur';

export const GROUP_TYPES: readonly GroupType[] = ['regular', 'abitur'] as const;

export function isGroupType(value: unknown): value is GroupType {
  return GROUP_TYPES.includes(value as GroupType);
}

/** Unknown values from the API degrade to a regular group. */
export function toGroupType(value: unknown): GroupType {
  return isGroupType(value) ? value : 'regular';
}

/** Mirrors the server's limit in `common::names`. */
export const GROUP_NAME_MAX_LENGTH = 100;

/**
 * Where a member stands with picking their courses in a group: `pending`
 * keeps them on the setup page, and only `done` personalizes the group.
 */
export type CourseSetup = 'done' | 'pending' | 'not_needed';

const COURSE_SETUPS: readonly CourseSetup[] = [
  'done',
  'pending',
  'not_needed',
] as const;

/** Unknown values from the API never lock anyone out of a group. */
export function toCourseSetup(value: unknown): CourseSetup {
  return COURSE_SETUPS.includes(value as CourseSetup)
    ? (value as CourseSetup)
    : 'not_needed';
}

/** Permissions a group can reassign on its permissions page. */
export type ConfigurablePermissionKey =
  | 'edit_group_profile'
  | 'edit_subjects_courses'
  | 'edit_schedule'
  | 'create_items'
  | 'upload_images'
  | 'manage_notes'
  | 'send_messages'
  | 'manage_schedule_changes'
  | 'manage_announcements'
  | 'moderate_members'
  | 'edit_other_content'
  | 'delete_other_content'
  | 'invite_members';

/** `edit_group_configuration` is fixed to admins in every group. */
export type PermissionKey =
  ConfigurablePermissionKey | 'edit_group_configuration';

export type GlobalRole = 'superadmin' | 'admin' | 'moderator' | 'user';

/** The lowest role a permission needs; superadmins are never a requirement. */
export type PermissionRole = Exclude<GlobalRole, 'superadmin'>;

export type PermissionMatrix = Record<
  ConfigurablePermissionKey,
  PermissionRole
>;
