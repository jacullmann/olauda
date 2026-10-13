import type { RouteLocationNamedRaw } from 'vue-router';

/** A lesson on one date, by its id as the schedule shows it that week. */
export function scheduleLessonRoute(
  groupId: string,
  date: string,
  lessonId: string,
): RouteLocationNamedRaw {
  return {
    name: 'group-schedule-lesson',
    params: { groupId, date, lessonId },
  };
}
