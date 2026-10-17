import { describe, expect, it } from 'vitest';
import type { LessonGroup, ScheduleConfig } from '@/modules/schedule/types';
import { buildScheduleLayout, freeSlotRuns, lessonRowsOf } from './layout';

const group = (slot: number, duration = 1): LessonGroup => ({
  key: `${slot}`,
  day: 1,
  lessons: [{ id: `${slot}`, day: 1, slot, duration, isDalton: false }],
});

describe('free slot runs', () => {
  it('joins free slots next to each other into one run', () => {
    expect(freeSlotRuns([group(1), group(5)], 5)).toEqual([
      { firstSlot: 2, lastSlot: 4 },
    ]);
  });

  it('keeps a single free slot between lessons on its own', () => {
    expect(freeSlotRuns([group(1), group(3), group(6)], 6)).toEqual([
      { firstSlot: 2, lastSlot: 2 },
      { firstSlot: 4, lastSlot: 5 },
    ]);
  });

  it('ends a run at a break it is split at', () => {
    expect(freeSlotRuns([group(1), group(6)], 6, { 2: 0, 3: 15 })).toEqual([
      { firstSlot: 2, lastSlot: 3 },
      { firstSlot: 4, lastSlot: 5 },
    ]);
  });

  it('counts every slot a lesson spans as filled, and none past the last', () => {
    expect(freeSlotRuns([group(2, 2), group(6)], 6)).toEqual([
      { firstSlot: 1, lastSlot: 1 },
      { firstSlot: 4, lastSlot: 5 },
    ]);
  });
});

describe('week layout', () => {
  const config: ScheduleConfig = {
    startTime: '08:00',
    totalSlots: 4,
    lessonDurationMins: 45,
    breaks: { 2: 20 },
    dayBreaks: { 3: { 1: 20 } },
  };
  const layout = buildScheduleLayout(config, [1, 2, 3], {
    breaksBeforeSlot: () => Infinity,
  });
  const lesson = (day: number, slot: number) => [
    { id: `${day}-${slot}`, day, slot, duration: 1, isDalton: false },
  ];

  it('gives a break any day has a row, shown on the days that have it', () => {
    const breaks = layout.rows.filter((row) => row.kind === 'break');
    expect(
      breaks.map((row) => [row.afterSlot, [...row.durationMinsByDay]]),
    ).toEqual([
      [1, [[3, 20]]],
      [
        2,
        [
          [1, 20],
          [2, 20],
        ],
      ],
    ]);
  });

  it('leaves out a break that free time takes in', () => {
    const withFreeTime = buildScheduleLayout(config, [1, 2], {
      breaksBeforeSlot: () => Infinity,
      breaksInFreeTime: (day) => new Set(day === 1 ? [2] : []),
    });
    const breaks = withFreeTime.rows.filter((row) => row.kind === 'break');
    expect(breaks.map((row) => [...row.durationMinsByDay])).toEqual([
      [[2, 20]],
    ]);

    const alone = buildScheduleLayout(config, [1], {
      breaksBeforeSlot: () => Infinity,
      breaksInFreeTime: () => new Set([2]),
    });
    expect(alone.rows.some((row) => row.kind === 'break')).toBe(false);
  });

  it('names the times most days share', () => {
    expect(lessonRowsOf(layout).map((row) => row.startTime)).toEqual([
      '08:00',
      '08:45',
      '09:50',
      '10:35',
    ]);
  });

  it('tells the times of a cell on a day that differs', () => {
    expect(layout.differingTimeOf(lesson(1, 2))).toBeNull();
    expect(layout.differingTimeOf(lesson(3, 2))).toBe('09:05 - 09:50');
    expect(layout.differingTimeOf(lesson(3, 3))).toBeNull();
  });
});
