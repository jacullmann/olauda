import { describe, expect, it } from 'vitest';
import type { Lesson, ScheduleConfig } from '@/modules/schedule/types';
import { findUpcomingLesson } from './upcomingLesson';

// Slot 1 runs 08:00-08:45, slot 2 08:45-09:30, and so on.
const config: ScheduleConfig = {
  startTime: '08:00',
  totalSlots: 8,
  lessonDurationMins: 45,
  breaks: {},
  dayBreaks: {},
};

function lesson(
  id: string,
  day: number,
  slot: number,
  extra: Partial<Lesson> = {},
): Lesson {
  return { id, day, slot, duration: 1, isDalton: false, ...extra };
}

/** 2024-01-01 is a Monday. */
function at(day: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2024, 0, day, hours, minutes);
}

const noCourses = new Set<string>();

describe('findUpcomingLesson', () => {
  it('returns null without lessons', () => {
    expect(
      findUpcomingLesson([], config, noCourses, at(1, '07:00')),
    ).toBeNull();
  });

  it('picks the next lesson to start, not the one in progress', () => {
    const lessons = [
      lesson('mon-1', 1, 1),
      lesson('mon-3', 1, 3),
      lesson('mon-2', 1, 2),
    ];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(1, '08:10'))?.id,
    ).toBe('mon-2');
  });

  it('looks ahead to later days of the week', () => {
    const lessons = [lesson('mon-1', 1, 1), lesson('wed-4', 3, 4)];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(1, '12:00'))?.id,
    ).toBe('wed-4');
  });

  it("wraps around to the week's first lesson after the last one", () => {
    const lessons = [lesson('tue-2', 2, 2), lesson('fri-5', 5, 5)];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(6, '10:00'))?.id,
    ).toBe('tue-2');
  });

  it('treats Sunday as the end of the week', () => {
    const lessons = [lesson('mon-1', 1, 1), lesson('fri-1', 5, 1)];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(7, '09:00'))?.id,
    ).toBe('mon-1');
  });

  it('skips cancelled lessons', () => {
    const lessons = [
      lesson('mon-2', 1, 2, { cancelled: true }),
      lesson('mon-3', 1, 3),
    ];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(1, '08:00'))?.id,
    ).toBe('mon-3');
  });

  it('returns null when every lesson is cancelled', () => {
    const lessons = [lesson('mon-2', 1, 2, { cancelled: true })];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(1, '08:00')),
    ).toBeNull();
  });

  it("prefers one of the member's courses among parallel lessons", () => {
    const lessons = [
      lesson('other', 1, 2, { courseId: 'course-a' }),
      lesson('own', 1, 2, { courseId: 'course-b', courseName: 'B' }),
    ];
    const taken = new Set(['course-b']);
    expect(findUpcomingLesson(lessons, config, taken, at(1, '08:00'))?.id).toBe(
      'own',
    );
  });

  it('keeps schedule order among parallel lessons the member does not take', () => {
    const lessons = [
      lesson('first', 1, 2, { courseId: 'a' }),
      lesson('second', 1, 2, { courseId: 'b' }),
    ];
    expect(
      findUpcomingLesson(lessons, config, noCourses, at(1, '08:00'))?.id,
    ).toBe('first');
  });

  it('prefers an own course also when wrapping around the week', () => {
    const lessons = [
      lesson('other', 1, 1, { courseId: 'course-a' }),
      lesson('own', 1, 1, { courseId: 'course-b' }),
    ];
    const taken = new Set(['course-b']);
    expect(findUpcomingLesson(lessons, config, taken, at(5, '18:00'))?.id).toBe(
      'own',
    );
  });
});
