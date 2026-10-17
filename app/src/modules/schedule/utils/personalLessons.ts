import type { Lesson, ScheduleSubject } from '@/modules/schedule/types';
import { resolveLessonSubject, subjectsById } from './lesson';

export interface PersonalLessonOptions {
  /** The courses the member takes. */
  courseIds: ReadonlySet<string>;
  /** The member finished picking their courses in this group. */
  hasCourseSelection: boolean;
  /** The member wants to see only their own courses. */
  isPersonalized: boolean;
  /** The group schedules every course on its own (Abitur). */
  schedulesCoursesIndividually: boolean;
}

/**
 * The group's lessons as the member sees them: a lesson for a whole subject
 * becomes one per course the member takes of it, and lessons of courses they
 * do not take are left out or marked, depending on the options.
 */
export function personalLessons(
  lessons: readonly Lesson[],
  subjects: readonly ScheduleSubject[],
  {
    courseIds,
    hasCourseSelection,
    isPersonalized,
    schedulesCoursesIndividually,
  }: PersonalLessonOptions,
): { lessons: Lesson[]; hiddenCount: number } {
  const result: Lesson[] = [];
  let hiddenCount = 0;
  if (lessons.length === 0) return { lessons: result, hiddenCount };

  const subjectMap = subjectsById(subjects);

  lessons.forEach((lesson) => {
    const { subjectId, subjectName, courses, ownCourseId, ownCourse } =
      resolveLessonSubject(lesson, subjectMap);

    // A lesson scheduled for one course is already personal — Abitur groups
    // schedule nearly all of them that way.
    if (ownCourseId) {
      result.push({
        ...lesson,
        _originalId: lesson.id,
        courseId: ownCourseId,
        courseName: ownCourse?.name,
        subjectName,
        outsideCourseSelection:
          hasCourseSelection && !courseIds.has(ownCourseId),
      });
      return;
    }

    // Without a course the lesson covers the whole group. In an Abitur group
    // that is what it means; a regular group splits it into the member's own
    // course of that subject.
    if (!isPersonalized || schedulesCoursesIndividually) {
      result.push({
        ...lesson,
        _originalId: lesson.id,
        subjectName,
        outsideCourseSelection:
          hasCourseSelection &&
          !schedulesCoursesIndividually &&
          courses.length > 0 &&
          !courses.some((c) => courseIds.has(c.id)),
      });
      return;
    }

    if (courses.length === 0) {
      result.push({ ...lesson, _originalId: lesson.id });
      return;
    }

    const ownCourses = courses.filter((c) => courseIds.has(c.id));
    if (ownCourses.length === 0) hiddenCount++;

    ownCourses.forEach((c) => {
      result.push({
        ...lesson,
        id: `${lesson.id}_${c.id}`,
        _originalId: lesson.id,
        courseId: c.id,
        courseName: c.name,
        subjectId,
        subjectName,
      });
    });
  });

  return { lessons: result, hiddenCount };
}
