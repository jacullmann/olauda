import { describe, expect, it } from 'vitest';
import type { LessonGroup, ScheduleConfig } from '@/modules/schedule/types';
import { activeOrNextGroupKeyAt } from './activeLesson';

// Slot 1 runs 08:00-08:45, slot 2 08:45-09:30, and so on.
const config: ScheduleConfig = {
  startTime: '08:00',
  totalSlots: 10,
  lessonDurationMins: 45,
  breaks: {},
  dayBreaks: {},
};
const days = [1, 2, 3, 4, 5];

function group(key: string, day: number, slot: number): LessonGroup {
  return {
    key,
    day,
    lessons: [{ id: key, day, slot, duration: 1, isDalton: false }],
  };
}

/** 2024-01-01 is a Monday. */
function at(day: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2024, 0, day, hours, minutes);
}

describe('activeOrNextGroupKeyAt', () => {
  const groups = [group('first', 1, 1), group('late', 1, 8)];

  it('picks the lesson running now', () => {
    expect(activeOrNextGroupKeyAt(groups, days, config, at(1, '08:10'))).toBe(
      'first',
    );
  });

  it('picks the next lesson right after one ended', () => {
    expect(activeOrNextGroupKeyAt(groups, days, config, at(1, '08:50'))).toBe(
      'late',
    );
  });

  it('picks nothing while the next lesson is still far off', () => {
    expect(
      activeOrNextGroupKeyAt(groups, days, config, at(1, '10:00')),
    ).toBeNull();
  });

  it('picks nothing once the week has no lesson left', () => {
    expect(
      activeOrNextGroupKeyAt(groups, days, config, at(5, '18:00')),
    ).toBeNull();
  });
});
