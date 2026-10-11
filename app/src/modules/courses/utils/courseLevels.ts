import type { Course, Subject } from '@/modules/courses/stores/useSubjectStore';
import {
  normalizeSubjectCategory,
  resolveCourseType,
  type CourseType,
} from '@/modules/courses/types';

/**
 * How a member of an Abitur group takes a subject, before the exact course is
 * known: not at all, as a Grund- or Leistungskurs, or, for a Zusatzkurs
 * subject, simply yes.
 */
export type CourseLevel = 'no' | 'gk' | 'lk' | 'yes';

const ABITUR = 'abitur';

function courseTypeOf(subject: Subject, course: Course): CourseType | null {
  return resolveCourseType(subject.category, ABITUR, course.courseType);
}

/**
 * The levels a subject offers, in display order. A Pflichtfach cannot be
 * dropped, a Zusatzkurs is only taken or not, and GK or LK show up only where
 * the subject runs a course of that type.
 */
export function courseLevelsOf(subject: Subject): CourseLevel[] {
  const category = normalizeSubjectCategory(subject.category, ABITUR);
  if (category === 'zk') return ['no', 'yes'];

  const types = new Set(
    (subject.courses ?? []).map((course) => courseTypeOf(subject, course)),
  );
  const levels = (['gk', 'lk'] as const).filter((level) => types.has(level));
  return category === 'optional' ? ['no', ...levels] : levels;
}

/** Courses of the subject a member at this level could attend. */
export function coursesAtLevel(subject: Subject, level: CourseLevel): Course[] {
  const courses = subject.courses ?? [];
  switch (level) {
    case 'no':
      return [];
    case 'yes':
      return courses;
    default:
      return courses.filter(
        (course) => courseTypeOf(subject, course) === level,
      );
  }
}

/**
 * Nothing for a subject that can be dropped; otherwise GK, the common case,
 * or whatever single level the subject runs.
 */
export function defaultCourseLevel(
  levels: readonly CourseLevel[],
): CourseLevel | null {
  if (levels.includes('no')) return 'no';
  if (levels.includes('gk')) return 'gk';
  return levels[0] ?? null;
}
