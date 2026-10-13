import type { Lesson, Substitution } from '@/modules/schedule/types';
import type { Task } from '@/modules/tasks/types';
import {
  lessonCourseId,
  lessonSubjectId,
} from '@/modules/schedule/utils/lesson';
import { withSubstitutions } from '@/modules/schedule/utils/substitutions';
import {
  daysSinceMonday,
  isoDate,
  mondayOf,
  parseIsoDate,
} from '@/modules/schedule/utils/weekday';
import { schoolDayOf } from './dueDate';

/**
 * When on its due day a task is likely due, as told by its subject's lessons
 * that day: in the first one that takes place, at no known time if the day has
 * none, or not at all if every one of them is cancelled.
 */
export type DueLesson =
  { kind: 'lesson'; slot: number } | { kind: 'none' } | { kind: 'cancelled' };

const DUE_LESSON_RANK: Record<DueLesson['kind'], number> = {
  lesson: 0,
  none: 1,
  cancelled: 2,
};

export interface DueLessonSchedule {
  lessons: readonly Lesson[];
  substitutionsOfWeek: (weekStart: string) => readonly Substitution[];
  /** The courses the member takes. */
  courses: readonly { subjectId: string; courseId: string }[];
}

type DueTask = Pick<Task, 'dueDate' | 'subjectId' | 'courseId'>;

interface SchoolDay {
  /** YYYY-MM-DD, the same for every task due that day. */
  key: string;
  /** The Monday of its week as YYYY-MM-DD, as substitutions name weeks. */
  weekStart: string;
  /** Numbered from Monday = 1, as lessons name their day. */
  day: number;
}

function schoolDayOfTask(task: Pick<Task, 'dueDate'>): SchoolDay {
  const key = schoolDayOf(new Date(task.dueDate));
  const date = parseIsoDate(key);
  return {
    key,
    weekStart: isoDate(mondayOf(date)),
    day: daysSinceMonday(date) + 1,
  };
}

/** The first and last week the tasks are due in, by their Mondays. */
export function dueWeekRange(
  tasks: readonly Pick<Task, 'dueDate'>[],
): { from: string; to: string } | null {
  const weekStarts = tasks.map((task) => schoolDayOfTask(task).weekStart);
  if (weekStarts.length === 0) return null;
  weekStarts.sort();
  return { from: weekStarts[0]!, to: weekStarts.at(-1)! };
}

/*
 * A lesson for the whole subject belongs to each of its courses. A task for
 * the whole subject is due in the member's own course of it where they take
 * one, as another course's lesson may come at a different time.
 */
function isLessonOf(
  lesson: Lesson,
  task: DueTask,
  ownCourseIds: ReadonlySet<string>,
): boolean {
  if (lesson.isDalton || lessonSubjectId(lesson) !== task.subjectId) {
    return false;
  }
  const courseId = lessonCourseId(lesson);
  if (!courseId) return true;
  if (task.courseId) return courseId === task.courseId;
  return ownCourseIds.size === 0 || ownCourseIds.has(courseId);
}

// A lesson given over to another subject is as good as cancelled for its own.
const takesPlace = (lesson: Lesson) =>
  !lesson.cancelled && !lesson.isSubstitutedSubject;

const ownCourseIdsOf = (
  task: DueTask,
  courses: DueLessonSchedule['courses'],
): ReadonlySet<string> =>
  new Set(
    courses
      .filter(({ subjectId }) => subjectId === task.subjectId)
      .map(({ courseId }) => courseId),
  );

function dueLessonAmong(
  dayLessons: readonly Lesson[],
  task: DueTask,
  courses: DueLessonSchedule['courses'],
): DueLesson {
  if (!task.subjectId) return { kind: 'none' };
  const ownCourseIds = ownCourseIdsOf(task, courses);
  const matching = dayLessons.filter((lesson) =>
    isLessonOf(lesson, task, ownCourseIds),
  );
  if (matching.length === 0) return { kind: 'none' };
  const held = matching.filter(takesPlace);
  if (held.length === 0) return { kind: 'cancelled' };
  return {
    kind: 'lesson',
    slot: Math.min(...held.map((lesson) => Number(lesson.slot))),
  };
}

function compareDueLessons(a: DueLesson, b: DueLesson): number {
  const byRank = DUE_LESSON_RANK[a.kind] - DUE_LESSON_RANK[b.kind];
  if (byRank !== 0 || a.kind !== 'lesson' || b.kind !== 'lesson') return byRank;
  return a.slot - b.slot;
}

/**
 * The tasks with the days in the order they came in, and the tasks of a day
 * in the order they are likely due in: those due in a lesson by its slot,
 * then those whose subject has no lesson that day, then those whose lessons
 * are all cancelled. `ownCoursesFirst` lets a task of a course the member
 * takes go ahead of one of another course where nothing else tells them apart.
 * Tasks alike in all of this keep their order.
 */
export function inDueOrder<T extends DueTask & Pick<Task, 'takesCourse'>>(
  tasks: readonly T[],
  schedule: DueLessonSchedule,
  { ownCoursesFirst }: { ownCoursesFirst: boolean },
): T[] {
  const lessonsByWeek = new Map<string, Lesson[]>();
  const lessonsOfWeek = (weekStart: string) => {
    let weekLessons = lessonsByWeek.get(weekStart);
    if (!weekLessons) {
      weekLessons = withSubstitutions(
        schedule.lessons,
        schedule.substitutionsOfWeek(weekStart),
      );
      lessonsByWeek.set(weekStart, weekLessons);
    }
    return weekLessons;
  };

  const dayOrder = new Map<string, number>();
  const entries = tasks.map((task, index) => {
    const schoolDay = schoolDayOfTask(task);
    if (!dayOrder.has(schoolDay.key)) dayOrder.set(schoolDay.key, index);
    const dayLessons = lessonsOfWeek(schoolDay.weekStart).filter(
      (lesson) => lesson.day === schoolDay.day,
    );
    return {
      task,
      index,
      dayIndex: dayOrder.get(schoolDay.key)!,
      dueLesson: dueLessonAmong(dayLessons, task, schedule.courses),
      isOtherCourse: ownCoursesFirst && task.takesCourse === false,
    };
  });

  return entries
    .sort(
      (a, b) =>
        a.dayIndex - b.dayIndex ||
        compareDueLessons(a.dueLesson, b.dueLesson) ||
        Number(a.isOtherCourse) - Number(b.isOtherCourse) ||
        a.index - b.index,
    )
    .map(({ task }) => task);
}

export interface LessonOnDate {
  lesson: Lesson;
  /** The day the lesson takes place, as YYYY-MM-DD. */
  date: string;
  /** Every lesson of that day, with the week's changes applied. */
  dayLessons: readonly Lesson[];
}

/**
 * Whether a task is due in the lesson: it is due that day, and the lesson is
 * the first of its subject's lessons that day to take place, or one of them
 * if they are all cancelled.
 */
export function isDueInLesson(
  task: DueTask,
  { lesson, date, dayLessons }: LessonOnDate,
  courses: DueLessonSchedule['courses'],
): boolean {
  if (
    !task.subjectId ||
    schoolDayOfTask(task).key !== date ||
    !isLessonOf(lesson, task, ownCourseIdsOf(task, courses))
  ) {
    return false;
  }
  const dueLesson = dueLessonAmong(dayLessons, task, courses);
  if (dueLesson.kind === 'cancelled') return true;
  return (
    dueLesson.kind === 'lesson' &&
    takesPlace(lesson) &&
    dueLesson.slot === Number(lesson.slot)
  );
}
