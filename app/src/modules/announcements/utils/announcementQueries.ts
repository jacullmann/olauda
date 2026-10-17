import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

export const announcementKeys = {
  group: (groupId: string) =>
    [...groupKeys.topic(groupId, 'announcements'), 'list'] as const,
  system: () => ['systemAnnouncements'] as const,
};

/** A group's announcements, newest first, each saying whether it was read. */
export const groupAnnouncementsQuery = (groupId: string) =>
  queryOptions({
    queryKey: announcementKeys.group(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/announcements', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

/** The platform's running announcements the user has yet to read. */
export const systemAnnouncementsQuery = () =>
  queryOptions({
    queryKey: announcementKeys.system(),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/system-announcements', { signal })),
  });
