import type { Lesson, ScheduleConfig } from '@/modules/schedule/types';
import { lessonMinutes } from './slotTimes';
import { daysSinceMonday } from './weekday';

const MINUTES_PER_DAY = 24 * 60;

interface TimedLesson {
  lesson: Lesson;
  /** Minutes since Monday midnight. */
  start: number;
  takesPlaceForMember: boolean;
}

function minutesIntoWeek(date: Date): number {
  return (
    daysSinceMonday(date) * MINUTES_PER_DAY +
    date.getHours() * 60 +
    date.getMinutes()
  );
}

function courseIdOf(lesson: Lesson): string | null {
  return lesson.courseId || lesson.courses?.id || null;
}

/** Earlier first; of parallel lessons, one of the member's own courses first. */
function compareTimedLessons(a: TimedLesson, b: TimedLesson): number {
  if (a.start !== b.start) return a.start - b.start;
  return Number(b.takesPlaceForMember) - Number(a.takesPlaceForMember);
}

/**
 * The next lesson to start after `now` that is not cancelled. Past the week's
 * last lesson, the schedule repeats, so the week's first lesson is next.
 */
export function findUpcomingLesson(
  lessons: readonly Lesson[],
  config: ScheduleConfig,
  takenCourseIds: ReadonlySet<string>,
  now: Date,
): Lesson | null {
  const timed = lessons
    .filter((lesson) => !lesson.cancelled)
    .map((lesson): TimedLesson => {
      const courseId = courseIdOf(lesson);
      return {
        lesson,
        start:
          (lesson.day - 1) * MINUTES_PER_DAY +
          lessonMinutes(config, lesson).start,
        takesPlaceForMember: !!courseId && takenCourseIds.has(courseId),
      };
    });

  const nowInWeek = minutesIntoWeek(now);
  const laterThisWeek = timed.filter(({ start }) => start > nowInWeek);
  const candidates = laterThisWeek.length ? laterThisWeek : timed;

  const next = candidates.reduce<TimedLesson | null>(
    (best, candidate) =>
      !best || compareTimedLessons(candidate, best) < 0 ? candidate : best,
    null,
  );
  return next?.lesson ?? null;
}
