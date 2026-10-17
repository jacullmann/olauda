import { describe, expect, it } from 'vitest';
import type { Lesson, ScheduleSubject } from '@/modules/schedule/types';
import { personalLessons, type PersonalLessonOptions } from './personalLessons';

const subjects: ScheduleSubject[] = [
  {
    id: 'math',
    name: 'Math',
    courses: [
      { id: 'm1', name: 'M1' },
      { id: 'm2', name: 'M2' },
    ],
  },
];

const lesson = (id: string, extra: Partial<Lesson> = {}): Lesson => ({
  id,
  day: 1,
  slot: 1,
  duration: 1,
  subjectId: 'math',
  isDalton: false,
  ...extra,
});

const options = (
  extra: Partial<PersonalLessonOptions> = {},
): PersonalLessonOptions => ({
  courseIds: new Set(['m2']),
  hasCourseSelection: true,
  isPersonalized: true,
  schedulesCoursesIndividually: false,
  ...extra,
});

describe('personalLessons', () => {
  it("splits a lesson for the whole subject into the member's courses", () => {
    const { lessons, hiddenCount } = personalLessons(
      [lesson('a')],
      subjects,
      options(),
    );
    expect(hiddenCount).toBe(0);
    expect(lessons).toEqual([
      expect.objectContaining({
        id: 'a_m2',
        _originalId: 'a',
        subjectName: 'Math',
        courseId: 'm2',
        courseName: 'M2',
      }),
    ]);
  });

  it('counts a lesson none of whose courses the member takes as hidden', () => {
    const { lessons, hiddenCount } = personalLessons(
      [lesson('a')],
      subjects,
      options({ courseIds: new Set() }),
    );
    expect(lessons).toEqual([]);
    expect(hiddenCount).toBe(1);
  });

  it('names the course of a lesson that only carries its id', () => {
    const { lessons } = personalLessons(
      [lesson('a', { courseId: 'm1' })],
      subjects,
      options(),
    );
    expect(lessons).toEqual([
      expect.objectContaining({
        id: 'a',
        courseName: 'M1',
        subjectName: 'Math',
        outsideCourseSelection: true,
      }),
    ]);
  });

  it('keeps the names the lesson comes with', () => {
    const { lessons } = personalLessons(
      [lesson('a', { subjectName: 'Maths', courseId: 'x', courseName: 'X' })],
      subjects,
      options({ isPersonalized: false }),
    );
    expect(lessons[0]).toMatchObject({ subjectName: 'Maths', courseName: 'X' });
  });
});
