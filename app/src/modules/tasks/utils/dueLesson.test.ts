import { describe, expect, it } from 'vitest';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import {
  dueWeekRange,
  inDueOrder,
  isDueInLesson,
  type DueLessonSchedule,
} from './dueLesson';

const TUESDAY = '2026-10-13T00:00:00.000Z';
const WEDNESDAY = '2026-10-14T00:00:00.000Z';
const NEXT_TUESDAY = '2026-10-20T00:00:00.000Z';
const WEEK = '2026-10-12';
const NEXT_WEEK = '2026-10-19';

interface TestTask {
  id: string;
  dueDate: string;
  subjectId: string | null;
  courseId: string | null;
  takesCourse?: boolean;
}

const task = (
  id: string,
  subjectId: string | null,
  {
    dueDate = TUESDAY,
    courseId = null,
    takesCourse,
  }: Partial<Pick<TestTask, 'dueDate' | 'courseId' | 'takesCourse'>> = {},
): TestTask => ({ id, dueDate, subjectId, courseId, takesCourse });

const lesson = (
  id: string,
  subjectId: string,
  day: number,
  slot: number,
  courseId: string | null = null,
): Lesson => ({ id, subjectId, courseId, day, slot, duration: 1, room: null });

const cancel = (lessonId: string, weekStart = WEEK): Substitution => ({
  id: `cancel-${lessonId}`,
  lessonId,
  weekStart,
  cancelled: true,
});

function schedule(
  lessons: Lesson[],
  {
    substitutions = [],
    courses = [],
  }: {
    substitutions?: Substitution[];
    courses?: DueLessonSchedule['courses'];
  } = {},
): DueLessonSchedule {
  return {
    lessons,
    substitutionsOfWeek: (weekStart) =>
      substitutions.filter((sub) => sub.weekStart === weekStart),
    courses,
  };
}

const ids = (tasks: TestTask[]) => tasks.map(({ id }) => id);

function order(
  tasks: TestTask[],
  dueSchedule: DueLessonSchedule,
  ownCoursesFirst = false,
) {
  return ids(inDueOrder(tasks, dueSchedule, { ownCoursesFirst }));
}

describe('inDueOrder', () => {
  it('orders the tasks of a day by their subject’s first lesson', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 5),
      lesson('math-2', 'math', 2, 1),
      lesson('art-1', 'art', 2, 3),
    ];

    expect(
      order([task('art', 'art'), task('math', 'math')], schedule(lessons)),
    ).toEqual(['math', 'art']);
  });

  it('keeps the days in the order they came in', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 6),
      lesson('art-1', 'art', 3, 1),
    ];
    const tasks = [
      task('math', 'math'),
      task('art', 'art', { dueDate: WEDNESDAY }),
    ];

    expect(order(tasks, schedule(lessons))).toEqual(['math', 'art']);
    expect(order(tasks.toReversed(), schedule(lessons))).toEqual([
      'art',
      'math',
    ]);
  });

  it('skips a cancelled lesson while the subject has another that day', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 1),
      lesson('math-2', 'math', 2, 5),
      lesson('art-1', 'art', 2, 3),
    ];

    expect(
      order(
        [task('math', 'math'), task('art', 'art')],
        schedule(lessons, { substitutions: [cancel('math-1')] }),
      ),
    ).toEqual(['art', 'math']);
  });

  it('puts tasks without a lesson that day after those with one', () => {
    const lessons = [
      lesson('art-1', 'art', 2, 8),
      lesson('math-1', 'math', 3, 1),
    ];

    expect(
      order(
        [task('math', 'math'), task('custom', null), task('art', 'art')],
        schedule(lessons),
      ),
    ).toEqual(['art', 'math', 'custom']);
  });

  it('puts tasks whose lessons are all cancelled last on their day', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 1),
      lesson('math-2', 'math', 2, 2),
      lesson('art-1', 'art', 2, 8),
      lesson('bio-1', 'bio', 3, 1),
    ];
    const tasks = [
      task('math', 'math'),
      task('bio', 'bio'),
      task('art', 'art'),
      task('next-day', 'bio', { dueDate: WEDNESDAY }),
    ];

    expect(
      order(
        tasks,
        schedule(lessons, {
          substitutions: [cancel('math-1'), cancel('math-2')],
        }),
      ),
    ).toEqual(['art', 'bio', 'math', 'next-day']);
  });

  it('applies only the changes of the week the task is due in', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 1),
      lesson('art-1', 'art', 2, 3),
    ];
    const tasks = [
      task('art', 'art', { dueDate: NEXT_TUESDAY }),
      task('math', 'math', { dueDate: NEXT_TUESDAY }),
    ];

    expect(
      order(tasks, schedule(lessons, { substitutions: [cancel('math-1')] })),
    ).toEqual(['math', 'art']);
    expect(
      order(
        tasks,
        schedule(lessons, { substitutions: [cancel('math-1', NEXT_WEEK)] }),
      ),
    ).toEqual(['art', 'math']);
  });

  it('follows a lesson moved to another day', () => {
    const lessons = [
      lesson('math-1', 'math', 3, 1),
      lesson('art-1', 'art', 2, 3),
    ];
    const moved: Substitution = {
      id: 'move',
      lessonId: 'math-1',
      weekStart: WEEK,
      day: 2,
    };

    expect(
      order(
        [task('art', 'art'), task('math', 'math')],
        schedule(lessons, { substitutions: [moved] }),
      ),
    ).toEqual(['math', 'art']);
  });

  it('treats a lesson given over to another subject as cancelled', () => {
    const lessons = [
      lesson('math-1', 'math', 2, 1),
      lesson('art-1', 'art', 2, 3),
    ];
    const replaced: Substitution = {
      id: 'replace',
      lessonId: 'math-1',
      weekStart: WEEK,
      subject: 'Physics',
    };

    expect(
      order(
        [task('math', 'math'), task('art', 'art')],
        schedule(lessons, { substitutions: [replaced] }),
      ),
    ).toEqual(['art', 'math']);
  });

  it('matches a course task to its course and the whole subject’s lessons', () => {
    const lessons = [
      lesson('math-a', 'math', 2, 1, 'math-a'),
      lesson('math-b', 'math', 2, 6, 'math-b'),
      lesson('art-1', 'art', 2, 3),
      lesson('bio-all', 'bio', 2, 2),
    ];
    const tasks = [
      task('math-b', 'math', { courseId: 'math-b' }),
      task('art', 'art'),
      task('bio-a', 'bio', { courseId: 'bio-a' }),
    ];

    expect(order(tasks, schedule(lessons))).toEqual(['bio-a', 'art', 'math-b']);
  });

  it('matches a subject task to the member’s own course of it', () => {
    const lessons = [
      lesson('math-a', 'math', 2, 1, 'math-a'),
      lesson('math-b', 'math', 2, 6, 'math-b'),
      lesson('art-1', 'art', 2, 3),
    ];
    const tasks = [task('math', 'math'), task('art', 'art')];

    expect(order(tasks, schedule(lessons))).toEqual(['math', 'art']);
    expect(
      order(
        tasks,
        schedule(lessons, {
          courses: [{ subjectId: 'math', courseId: 'math-b' }],
        }),
      ),
    ).toEqual(['art', 'math']);
  });

  describe('with the member’s own courses first', () => {
    const lessons = [
      lesson('math-a', 'math', 2, 1, 'math-a'),
      lesson('math-b', 'math', 2, 1, 'math-b'),
      lesson('art-1', 'art', 2, 3),
    ];

    it('breaks a tie in favour of the member’s course', () => {
      const tasks = [
        task('other', 'math', { courseId: 'math-a', takesCourse: false }),
        task('own', 'math', { courseId: 'math-b', takesCourse: true }),
      ];

      expect(order(tasks, schedule(lessons), true)).toEqual(['own', 'other']);
      expect(order(tasks, schedule(lessons), false)).toEqual(['other', 'own']);
    });

    it('breaks ties among tasks without a lesson or with cancelled ones', () => {
      const tasks = [
        task('other-none', 'bio', { takesCourse: false }),
        task('own-none', 'chem', { takesCourse: true }),
      ];

      expect(order(tasks, schedule(lessons), true)).toEqual([
        'own-none',
        'other-none',
      ]);
    });

    it('never moves the member’s course ahead of an earlier lesson', () => {
      const tasks = [
        task('other', 'math', { courseId: 'math-a', takesCourse: false }),
        task('own', 'art', { takesCourse: true }),
      ];

      expect(order(tasks, schedule(lessons), true)).toEqual(['other', 'own']);
    });
  });
});

describe('dueWeekRange', () => {
  it('spans the weeks of the earliest and latest task', () => {
    expect(
      dueWeekRange([
        { dueDate: NEXT_TUESDAY },
        { dueDate: TUESDAY },
        { dueDate: WEDNESDAY },
      ]),
    ).toEqual({ from: WEEK, to: NEXT_WEEK });
  });

  it('is empty without tasks', () => {
    expect(dueWeekRange([])).toBeNull();
  });
});

describe('isDueInLesson', () => {
  const TUESDAY_DATE = '2026-10-13';

  function dueIn(
    dueTask: TestTask,
    dueLesson: Lesson,
    dayLessons: Lesson[],
    courses: DueLessonSchedule['courses'] = [],
  ) {
    return isDueInLesson(
      dueTask,
      { lesson: dueLesson, date: TUESDAY_DATE, dayLessons },
      courses,
    );
  }

  it('matches the first lesson of the task’s subject that day', () => {
    const first = lesson('math-1', 'math', 2, 1);
    const second = lesson('math-2', 'math', 2, 5);
    const dayLessons = [second, first];

    expect(dueIn(task('t', 'math'), first, dayLessons)).toBe(true);
    expect(dueIn(task('t', 'math'), second, dayLessons)).toBe(false);
  });

  it('skips a task due another day or in another subject', () => {
    const math = lesson('math-1', 'math', 2, 1);

    expect(dueIn(task('t', 'math', { dueDate: WEDNESDAY }), math, [math])).toBe(
      false,
    );
    expect(dueIn(task('t', 'art'), math, [math])).toBe(false);
    expect(dueIn(task('t', null), math, [math])).toBe(false);
  });

  it('moves on to the next lesson once the first is cancelled', () => {
    const first = { ...lesson('math-1', 'math', 2, 1), cancelled: true };
    const second = lesson('math-2', 'math', 2, 5);

    expect(dueIn(task('t', 'math'), first, [first, second])).toBe(false);
    expect(dueIn(task('t', 'math'), second, [first, second])).toBe(true);
  });

  it('keeps a task in each lesson when all of them are cancelled', () => {
    const first = { ...lesson('math-1', 'math', 2, 1), cancelled: true };
    const second = { ...lesson('math-2', 'math', 2, 5), cancelled: true };

    expect(dueIn(task('t', 'math'), first, [first, second])).toBe(true);
    expect(dueIn(task('t', 'math'), second, [first, second])).toBe(true);
  });

  it('matches a course’s task only in that course’s lesson', () => {
    const courseA = lesson('math-a', 'math', 2, 1, 'a');
    const courseB = lesson('math-b', 'math', 2, 3, 'b');
    const dayLessons = [courseA, courseB];
    const courseTask = task('t', 'math', { courseId: 'b' });

    expect(dueIn(courseTask, courseA, dayLessons)).toBe(false);
    expect(dueIn(courseTask, courseB, dayLessons)).toBe(true);
  });

  it('matches a subject’s task in the member’s own course', () => {
    const courseA = lesson('math-a', 'math', 2, 1, 'a');
    const courseB = lesson('math-b', 'math', 2, 3, 'b');
    const dayLessons = [courseA, courseB];
    const courses = [{ subjectId: 'math', courseId: 'b' }];

    expect(dueIn(task('t', 'math'), courseA, dayLessons, courses)).toBe(false);
    expect(dueIn(task('t', 'math'), courseB, dayLessons, courses)).toBe(true);
  });

  it('never matches a Dalton lesson', () => {
    const dalton = { ...lesson('dalton', 'math', 2, 1), isDalton: true };

    expect(dueIn(task('t', 'math'), dalton, [dalton])).toBe(false);
  });
});
