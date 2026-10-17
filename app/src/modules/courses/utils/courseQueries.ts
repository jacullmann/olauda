import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

export const courseKeys = {
  subjects: (groupId: string) =>
    [...groupKeys.topic(groupId, 'subjects'), 'list'] as const,
};

/** A group's subjects with their courses, as every member sees them. */
export const subjectsQuery = (groupId: string) =>
  queryOptions({
    queryKey: courseKeys.subjects(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/schedule/subjects', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });
