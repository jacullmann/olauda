import { describe, expect, it } from 'vitest';
import type {
  CourseCandidates,
  CourseLesson,
  CourseState,
} from './courseResolution';
import { inScheduleOrder } from './scheduleOrder';

const lesson = (courseId: string, day: number, slot: number): CourseLesson => ({
  courseId,
  day,
  slot,
});

const subjects = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (ordered: { id: string }[]) => ordered.map(({ id }) => id);

function openStates(candidates: CourseCandidates) {
  return new Map<string, CourseState>(
    [...candidates.values()].flat().map((courseId) => [courseId, 'open']),
  );
}

describe('inScheduleOrder', () => {
  it('orders by the first lesson in the week', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['math', ['math-1', 'math-2']],
    ]);
    const lessons = [
      lesson('art-1', 5, 1),
      lesson('art-2', 4, 3),
      lesson('math-1', 2, 6),
      lesson('math-2', 3, 1),
    ];

    expect(
      ids(
        inScheduleOrder(
          subjects('art', 'math'),
          candidates,
          openStates(candidates),
          lessons,
        ),
      ),
    ).toEqual(['math', 'art']);
  });

  it('reads a day from its first slot to its last', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['math', ['math-1', 'math-2']],
    ]);
    const lessons = [
      lesson('art-1', 1, 4),
      lesson('art-2', 3, 1),
      lesson('math-1', 1, 2),
      lesson('math-2', 2, 1),
    ];

    expect(
      ids(
        inScheduleOrder(
          subjects('art', 'math'),
          candidates,
          openStates(candidates),
          lessons,
        ),
      ),
    ).toEqual(['math', 'art']);
  });

  it('breaks a tie in one cell by the next lesson', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['math', ['math-1', 'math-2']],
    ]);
    const lessons = [
      lesson('art-1', 1, 1),
      lesson('art-2', 4, 1),
      lesson('math-1', 1, 1),
      lesson('math-2', 2, 1),
    ];

    expect(
      ids(
        inScheduleOrder(
          subjects('art', 'math'),
          candidates,
          openStates(candidates),
          lessons,
        ),
      ),
    ).toEqual(['math', 'art']);
  });

  it('skips courses that clash with a pick', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['math', ['math-1', 'math-2']],
    ]);
    const states = new Map<string, CourseState>([
      ['art-1', 'open'],
      ['art-2', 'open'],
      ['math-1', 'excluded'],
      ['math-2', 'open'],
    ]);
    const lessons = [
      lesson('art-1', 2, 1),
      lesson('art-2', 3, 1),
      lesson('math-1', 1, 1),
      lesson('math-2', 4, 1),
    ];

    expect(
      ids(
        inScheduleOrder(subjects('math', 'art'), candidates, states, lessons),
      ),
    ).toEqual(['art', 'math']);
  });

  it('ranks a subject left without an open course by all of its courses', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['math', ['math-1', 'math-2']],
    ]);
    const states = new Map<string, CourseState>([
      ['art-1', 'open'],
      ['art-2', 'open'],
      ['math-1', 'excluded'],
      ['math-2', 'excluded'],
    ]);
    const lessons = [
      lesson('art-1', 2, 1),
      lesson('art-2', 3, 1),
      lesson('math-1', 1, 1),
      lesson('math-2', 4, 1),
    ];

    expect(
      ids(
        inScheduleOrder(subjects('art', 'math'), candidates, states, lessons),
      ),
    ).toEqual(['math', 'art']);
  });

  it('puts subjects without lessons last, keeping their order', () => {
    const candidates: CourseCandidates = new Map([
      ['art', ['art-1', 'art-2']],
      ['music', ['music-1', 'music-2']],
      ['math', ['math-1', 'math-2']],
    ]);

    expect(
      ids(
        inScheduleOrder(
          subjects('art', 'music', 'math'),
          candidates,
          openStates(candidates),
          [lesson('math-1', 5, 8)],
        ),
      ),
    ).toEqual(['math', 'art', 'music']);
  });
});
