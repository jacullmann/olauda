import type {
  BannedMemberDto,
  CourseDto,
  CourseSetup as ApiCourseSetup,
  GroupInviteDto,
  GroupMemberDto,
  GroupPermissions,
  GroupSummaryDto,
  GroupType as ApiGroupType,
  MemberRole as ApiMemberRole,
  Permission,
  Role,
  SubjectDto,
  SubstitutionDto,
} from '@/api/schema';

export type MemberRole = ApiMemberRole;

/** The roles that can be assigned directly; ownership is only transferred. */
export type AssignableMemberRole = Exclude<MemberRole, 'owner'>;

export type GroupMember = GroupMemberDto;

/** A group the user belongs to, with what they may do in it. */
export type UserGroup = GroupSummaryDto;

export type ScheduleSubstitution = SubstitutionDto;

export type AdminCourse = CourseDto;

export type AdminSubject = SubjectDto;

export type GroupInviteLog = GroupInviteDto;

export type BannedMember = BannedMemberDto;

/**
 * A regular group is a class that attends every lesson together. An Abitur
 * group is a whole year: every subject is course-based and each course is
 * scheduled on its own, so two courses of the same subject can run on
 * different days.
 */
export type GroupType = ApiGroupType;

export const GROUP_TYPES: readonly GroupType[] = ['regular', 'abitur'] as const;

/** Mirrors the server's limit in `common::names`. */
export const GROUP_NAME_MAX_LENGTH = 100;

/**
 * Where a member stands with picking their courses in a group: `pending`
 * keeps them on the setup page, and only `done` personalizes the group.
 */
export type CourseSetup = ApiCourseSetup;

/** Permissions a group can reassign on its permissions page. */
export type ConfigurablePermissionKey = keyof GroupPermissions;

/** `edit_group_configuration` is fixed to admins in every group. */
export type PermissionKey = Permission;

export type GlobalRole = Role;

/** The lowest role a permission needs; superadmins are never a requirement. */
export type PermissionRole = Exclude<GlobalRole, 'superadmin'>;

export type PermissionMatrix = GroupPermissions;
