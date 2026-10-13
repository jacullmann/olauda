import type {
  Lesson,
  LessonGroup,
  ScheduleCourse,
  ScheduleSubject,
} from '@/modules/schedule/types';
import { DALTON_SUBJECT_KEY } from '@/modules/courses/types';
import { subjectLabel } from '@/modules/courses/utils/subjectLabels';

/**
 * The stored subject name of a lesson, or the Dalton key for the pseudo-subject.
 * Both double as `common.subjects.*` translation keys where one exists.
 */
export function lessonSubjectName(
  lesson: Pick<Lesson, 'isDalton' | 'subjects' | 'subject' | 'subjectAbbr'>,
): string {
  if (lesson.isDalton) return DALTON_SUBJECT_KEY;
  return lesson.subjects?.name || lesson.subject || lesson.subjectAbbr || '';
}

/** The name a lesson is shown with, in the reader's language. */
export function lessonDisplayName(
  lesson: Pick<
    Lesson,
    'isDalton' | 'subjects' | 'subject' | 'subjectAbbr' | 'isSubstitutedSubject'
  >,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  if (lesson.isSubstitutedSubject && lesson.subject) {
    return subjectLabel(lesson.subject, t, te);
  }

  const subjectName = lessonSubjectName(lesson);
  return subjectName ? subjectLabel(subjectName, t, te) : '';
}

export const lessonSubjectId = (
  lesson: Pick<Lesson, 'subjectId' | 'subjects'>,
): string | null => lesson.subjectId ?? lesson.subjects?.id ?? null;

export const lessonCourseId = (
  lesson: Pick<Lesson, 'courseId' | 'courses'>,
): string | null => lesson.courseId ?? lesson.courses?.id ?? null;

/** How many slots a lesson fills; a missing or zero duration still fills its own. */
export function lessonSpan(lesson: { duration?: number | null }): number {
  return Math.max(1, Number(lesson.duration || 1));
}

/** The last slot a lesson fills. */
export function lessonLastSlot(
  lesson: Pick<Lesson, 'slot'> & { duration?: number | null },
): number {
  return Number(lesson.slot) + lessonSpan(lesson) - 1;
}

export interface SlotRange {
  firstSlot: number;
  lastSlot: number;
}

/** The slots a set of lessons fills together, from the first start to the last end. */
export function lessonsSlotRange(
  lessons: readonly (Pick<Lesson, 'slot'> & { duration?: number | null })[],
): SlotRange {
  return {
    firstSlot: Math.min(...lessons.map((lesson) => Number(lesson.slot))),
    lastSlot: Math.max(...lessons.map(lessonLastSlot)),
  };
}

/**
 * Lessons of a day whose slots overlap, directly or through another lesson,
 * share one cell. A cell fills its rows alone, so overlapping cells would
 * cover each other instead of showing every lesson.
 */
export function groupOverlappingLessons(lessons: Lesson[]): LessonGroup[] {
  const chronological = lessons.toSorted(
    (a, b) => a.day - b.day || a.slot - b.slot,
  );
  const groups: LessonGroup[] = [];
  let current: LessonGroup | undefined;
  let currentLastSlot = 0;
  for (const lesson of chronological) {
    if (current?.day === lesson.day && lesson.slot <= currentLastSlot) {
      current.lessons.push(lesson);
      currentLastSlot = Math.max(currentLastSlot, lessonLastSlot(lesson));
    } else {
      current = {
        key: `${lesson.day}-${lesson.slot}`,
        day: lesson.day,
        lessons: [lesson],
      };
      groups.push(current);
      currentLastSlot = lessonLastSlot(lesson);
    }
  }
  return groups;
}

export function lessonGroupsByDay(
  groups: readonly LessonGroup[],
): ReadonlyMap<number, LessonGroup[]> {
  const byDay = new Map<number, LessonGroup[]>();
  for (const group of groups) {
    const dayGroups = byDay.get(group.day);
    if (dayGroups) dayGroups.push(group);
    else byDay.set(group.day, [group]);
  }
  return byDay;
}

export function subjectsById(
  subjects: readonly ScheduleSubject[],
): ReadonlyMap<string, ScheduleSubject> {
  return new Map(
    subjects
      .filter((subject) => subject?.id)
      .map((subject) => [subject.id, subject]),
  );
}

export interface ResolvedLessonSubject {
  subjectId: string | null;
  subjects: Lesson['subjects'];
  /** Every course of the lesson's subject. */
  courses: ScheduleCourse[];
  ownCourseId: string | null;
  /** The one course the lesson is scheduled for, if it names one the group knows. */
  ownCourse: ScheduleCourse | null;
}

/** A lesson's subject and course, filled in from the group's subjects where the lesson only carries ids. */
export function resolveLessonSubject(
  lesson: Lesson,
  subjects: ReadonlyMap<string, ScheduleSubject>,
): ResolvedLessonSubject {
  const subjectId = lesson.subjectId || lesson.subjects?.id;
  const subject = subjectId ? subjects.get(subjectId) : undefined;
  const courses = subject?.courses ?? [];
  const ownCourseId = lesson.courseId || lesson.courses?.id || null;

  return {
    subjectId: subjectId || null,
    subjects:
      lesson.subjects ||
      (subject ? { id: subject.id, name: subject.name } : null),
    courses,
    ownCourseId,
    ownCourse:
      lesson.courses ??
      (ownCourseId
        ? (courses.find((course) => course.id === ownCourseId) ?? null)
        : null),
  };
}

/** The group subject a lesson belongs to, by its id or, for a lesson that only carries a name, by that name. */
export function findLessonSubject<Subject extends ScheduleSubject>(
  lesson: Pick<Lesson, 'subjectId' | 'subjects' | 'subject'>,
  subjects: readonly Subject[],
): Subject | undefined {
  const subjectId = lesson.subjectId || lesson.subjects?.id;
  const subjectName = lesson.subject?.toLowerCase();
  return subjects.find(
    (subject) =>
      subject.id === subjectId ||
      (!!subjectName && subject.name.toLowerCase() === subjectName),
  );
}
