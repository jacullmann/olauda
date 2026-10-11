import type {
  CourseCandidates,
  CourseLesson,
  CourseState,
} from './courseResolution';

const byPosition = (a: CourseLesson, b: CourseLesson) =>
  a.day - b.day || a.slot - b.slot;

/** Every cell of the timetable a subject appears in, earliest first. */
function cellsBySubject(
  subjectOfCourse: ReadonlyMap<string, string>,
  lessons: readonly CourseLesson[],
): Map<string, number[]> {
  const appearances = lessons
    .flatMap((lesson) => {
      const subjectId = lesson.courseId && subjectOfCourse.get(lesson.courseId);
      return subjectId ? [{ subjectId, lesson }] : [];
    })
    .sort((a, b) => byPosition(a.lesson, b.lesson));

  const cells = new Map<string, number[]>();
  let cell = -1;
  appearances.forEach(({ subjectId, lesson }, index) => {
    const previous = appearances[index - 1]?.lesson;
    if (!previous || byPosition(previous, lesson) !== 0) cell++;
    const subjectCells = cells.get(subjectId) ?? [];
    if (subjectCells.at(-1) !== cell) subjectCells.push(cell);
    cells.set(subjectId, subjectCells);
  });
  return cells;
}

/** A subject that stops appearing ranks as if its next cell came last. */
function compareCells(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? Infinity) - (b[i] ?? Infinity);
    if (difference) return difference;
  }
  return 0;
}

/**
 * Orders subjects the way a member meets them reading the timetable day by
 * day: by the first lesson of a course they can pick right now, then by the
 * next one. A phone shows one day at a time and the status cuts off all but
 * the first few subjects, so one met on Friday must not lead the list.
 * Subjects whose courses all clash with a pick still rank by those courses.
 */
export function inScheduleOrder<Subject extends { id: string }>(
  subjects: readonly Subject[],
  candidates: CourseCandidates,
  states: ReadonlyMap<string, CourseState>,
  lessons: readonly CourseLesson[],
): Subject[] {
  const subjectOfCourse = new Map<string, string>();
  for (const subject of subjects) {
    const courseIds = candidates.get(subject.id) ?? [];
    const open = courseIds.filter((id) => states.get(id) === 'open');
    for (const courseId of open.length > 0 ? open : courseIds) {
      subjectOfCourse.set(courseId, subject.id);
    }
  }

  const cells = cellsBySubject(subjectOfCourse, lessons);
  const cellsOf = (subject: Subject) => cells.get(subject.id) ?? [];
  return [...subjects].sort((a, b) => compareCells(cellsOf(a), cellsOf(b)));
}
