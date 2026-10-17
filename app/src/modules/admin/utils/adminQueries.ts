import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type {
  AdminGroupListQuery,
  AdminUserListQuery,
  EventLogQuery,
  MetricPoint,
  MetricsRange,
  ServerMetrics,
} from '@/modules/admin/types';
import { announcementKeys } from '@/modules/announcements/utils/announcementQueries';

/**
 * Everything the superadmin area loads. A change to an account or a group
 * invalidates its whole branch, the lists and detail pages included.
 */
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  statsSummary: () => [...adminKeys.stats(), 'summary'] as const,
  dailyActivity: () => [...adminKeys.stats(), 'daily'] as const,
  weeklyRhythm: () => [...adminKeys.stats(), 'weekly-rhythm'] as const,
  accountSecurity: () => [...adminKeys.stats(), 'account-security'] as const,
  serverMetrics: (range: MetricsRange) =>
    [...adminKeys.all, 'server-metrics', range] as const,
  emails: () => [...adminKeys.all, 'emails'] as const,
  emailActivity: () => [...adminKeys.emails(), 'activity'] as const,
  emailQuota: () => [...adminKeys.emails(), 'quota'] as const,
  cleanupJobs: () => [...adminKeys.all, 'cleanup-jobs'] as const,
  events: () => [...adminKeys.all, 'events'] as const,
  eventLog: (query: EventLogQuery) => [...adminKeys.events(), query] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userLists: () => [...adminKeys.users(), 'list'] as const,
  userList: (query: AdminUserListQuery) =>
    [...adminKeys.userLists(), query] as const,
  userDetails: () => [...adminKeys.users(), 'detail'] as const,
  user: (userId: string) => [...adminKeys.userDetails(), userId] as const,
  userMemberships: (userId: string) =>
    [...adminKeys.user(userId), 'groups'] as const,
  groups: () => [...adminKeys.all, 'groups'] as const,
  groupLists: () => [...adminKeys.groups(), 'list'] as const,
  groupList: (query: AdminGroupListQuery) =>
    [...adminKeys.groupLists(), query] as const,
  group: (groupId: string) =>
    [...adminKeys.groups(), 'detail', groupId] as const,
  reports: () => [...adminKeys.all, 'reports'] as const,
  systemAnnouncements: () =>
    [...adminKeys.all, 'system-announcements'] as const,
  accessControls: () => [...adminKeys.all, 'access-controls'] as const,
};

/** Refreshes the managed announcements and the banner the admin sees in the app. */
export function invalidateSystemAnnouncements(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminKeys.systemAnnouncements(),
    }),
    queryClient.invalidateQueries({ queryKey: announcementKeys.system() }),
  ]);
}

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: adminKeys.statsSummary(),
    queryFn: ({ signal }) => unwrap(api.GET('/admin/stats', { signal })),
  });

export const dailyActivityQuery = () =>
  queryOptions({
    queryKey: adminKeys.dailyActivity(),
    queryFn: ({ signal }) => unwrap(api.GET('/admin/stats/daily', { signal })),
  });

export const weeklyRhythmQuery = () =>
  queryOptions({
    queryKey: adminKeys.weeklyRhythm(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/stats/weekly-rhythm', { signal })),
  });

export const accountSecurityQuery = () =>
  queryOptions({
    queryKey: adminKeys.accountSecurity(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/stats/account-security', { signal })),
  });

// The schema's `MetricPoint` is a `[timestamp, value]` tuple, but openapi-fetch
// types responses through `Readable<T>` (openapi-typescript-helpers), whose
// `T extends (infer E)[] ? Readable<E>[]` branch turns tuples into arrays.
const metricPoints = (points: readonly (number | null)[][]): MetricPoint[] =>
  points.flatMap(([timestamp, value]): MetricPoint[] =>
    typeof timestamp === 'number' ? [[timestamp, value ?? null]] : [],
  );

export const serverMetricsQuery = (range: MetricsRange) =>
  queryOptions({
    queryKey: adminKeys.serverMetrics(range),
    queryFn: async ({ signal }): Promise<ServerMetrics> => {
      const metrics = await unwrap(
        api.GET('/admin/server-metrics', {
          params: { query: { range } },
          signal,
        }),
      );
      return {
        ...metrics,
        cpu: metricPoints(metrics.cpu),
        networkIn: metricPoints(metrics.networkIn),
        networkOut: metricPoints(metrics.networkOut),
      };
    },
  });

export const emailActivityQuery = () =>
  queryOptions({
    queryKey: adminKeys.emailActivity(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/emails/activity', { signal })),
  });

export const emailQuotaQuery = () =>
  queryOptions({
    queryKey: adminKeys.emailQuota(),
    queryFn: ({ signal }) => unwrap(api.GET('/admin/emails/quota', { signal })),
  });

export const cleanupJobsQuery = () =>
  queryOptions({
    queryKey: adminKeys.cleanupJobs(),
    queryFn: ({ signal }) => unwrap(api.GET('/admin/cleanup-jobs', { signal })),
  });

/** The log from its newest (or oldest) entry on, a page per cursor. */
export const eventLogQuery = (query: EventLogQuery) =>
  infiniteQueryOptions({
    queryKey: adminKeys.eventLog(query),
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.GET('/admin/events', {
          params: { query: { ...query, cursor: pageParam } },
          signal,
        }),
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

export const adminUsersQuery = (query: AdminUserListQuery) =>
  queryOptions({
    queryKey: adminKeys.userList(query),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/users', { params: { query }, signal })),
  });

export const adminUserQuery = (userId: string) =>
  queryOptions({
    queryKey: adminKeys.user(userId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/admin/users/{id}', {
          params: { path: { id: userId } },
          signal,
        }),
      ),
  });

export const adminUserMembershipsQuery = (userId: string) =>
  queryOptions({
    queryKey: adminKeys.userMemberships(userId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/admin/users/{id}/groups', {
          params: { path: { id: userId } },
          signal,
        }),
      ),
  });

export const adminGroupsQuery = (query: AdminGroupListQuery) =>
  queryOptions({
    queryKey: adminKeys.groupList(query),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/groups', { params: { query }, signal })),
  });

export const adminGroupQuery = (groupId: string) =>
  queryOptions({
    queryKey: adminKeys.group(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/admin/groups/{id}', {
          params: { path: { id: groupId } },
          signal,
        }),
      ),
  });

export const reportsQuery = () =>
  queryOptions({
    queryKey: adminKeys.reports(),
    queryFn: ({ signal }) => unwrap(api.GET('/admin/reports', { signal })),
  });

/** Latest start first, as the server sends them. */
export const adminSystemAnnouncementsQuery = () =>
  queryOptions({
    queryKey: adminKeys.systemAnnouncements(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/system-announcements', { signal })),
  });

export const accessControlsQuery = () =>
  queryOptions({
    queryKey: adminKeys.accessControls(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/admin/access-controls', { signal })),
  });
