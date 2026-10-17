import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { GroupTopic } from '@/api/schema';

/**
 * Everything loaded for one group sits below its key, sorted by the live
 * update topic that announces its changes: an event for a group's topic
 * invalidates exactly `groupKeys.topic(groupId, topic)`, and leaving the group
 * can drop all of it.
 */
export const groupKeys = {
  all: ['groups'] as const,
  group: (groupId: string) => [...groupKeys.all, groupId] as const,
  topic: (groupId: string, topic: GroupTopic) =>
    [...groupKeys.group(groupId), topic] as const,
  summary: (groupId: string) =>
    [...groupKeys.topic(groupId, 'settings'), 'summary'] as const,
  permissions: (groupId: string) =>
    [...groupKeys.topic(groupId, 'settings'), 'permissions'] as const,
  members: (groupId: string) =>
    [...groupKeys.topic(groupId, 'members'), 'list'] as const,
  bans: (groupId: string) =>
    [...groupKeys.topic(groupId, 'members'), 'bans'] as const,
  invites: (groupId: string) =>
    [...groupKeys.topic(groupId, 'members'), 'invites'] as const,
  /** Members see the subjects at `courseKeys.subjects`. */
  adminSubjects: (groupId: string) =>
    [...groupKeys.topic(groupId, 'subjects'), 'admin'] as const,
  /** Every change of the schedule, past weeks included. */
  adminSubstitutions: (groupId: string) =>
    [
      ...groupKeys.topic(groupId, 'schedule'),
      'substitutions',
      'admin',
    ] as const,
};

/** A group the caller may open, such as one a superadmin is not a member of. */
export const groupSummaryQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.summary(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const groupMembersQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.members(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/members', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const groupBansQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.bans(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/banned-users', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const groupInvitesQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.invites(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/invites', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const groupPermissionsQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.permissions(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/permissions', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

/** The subjects with their courses, for members who may edit them. */
export const groupAdminSubjectsQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.adminSubjects(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/subjects', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const groupAdminSubstitutionsQuery = (groupId: string) =>
  queryOptions({
    queryKey: groupKeys.adminSubstitutions(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/schedule/subs', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });
