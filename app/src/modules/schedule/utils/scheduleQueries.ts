import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

/** The weeks of schedule changes asked for, each named by its Monday. */
export interface WeekRange {
  from: string;
  to: string;
}

export const scheduleKeys = {
  all: (groupId: string) => groupKeys.topic(groupId, 'schedule'),
  /** The member's timetable, without the lessons of courses they leave out. */
  lessons: (groupId: string) =>
    [...scheduleKeys.all(groupId), 'lessons'] as const,
  /** Every lesson of the group, whoever takes it. */
  timetable: (groupId: string) =>
    [...scheduleKeys.all(groupId), 'timetable'] as const,
  substitutions: (groupId: string) =>
    [...scheduleKeys.all(groupId), 'substitutions'] as const,
  substitutionsOf: (groupId: string, weeks: WeekRange) =>
    [...scheduleKeys.substitutions(groupId), weeks] as const,
};

export const scheduleQuery = (groupId: string) =>
  queryOptions({
    queryKey: scheduleKeys.lessons(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/schedule', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

/** The whole timetable without personalization, which every member may read. */
export const timetableQuery = (groupId: string) =>
  queryOptions({
    queryKey: scheduleKeys.timetable(groupId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/admin/schedule', {
          params: { path: { group_id: groupId } },
          signal,
        }),
      ),
  });

export const substitutionsQuery = (groupId: string, weeks: WeekRange) =>
  queryOptions({
    queryKey: scheduleKeys.substitutionsOf(groupId, weeks),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/schedule/subs', {
          params: { path: { group_id: groupId }, query: weeks },
          signal,
        }),
      ),
  });
