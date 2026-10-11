import type { LessonGroup, ScheduleConfig } from '@/modules/schedule/types';
import { lessonsSlotRange } from './lesson';
import { slotRangeMinutes } from './slotTimes';
import { daysSinceMonday } from './weekday';

const MINUTES_PER_DAY = 24 * 60;
/** Just after a lesson the next one is still the one to look at. */
const JUST_FINISHED_MINUTES = 10;
/** A next lesson further away than this is not highlighted yet. */
const NEXT_LESSON_HORIZON_MINUTES = 120;

interface TimeBlock {
  key: string;
  start: number;
  end: number;
}

/**
 * The cell of this week's lessons to highlight at `now`: the one running,
 * else the next one, unless the last one ended a while ago and the next is
 * still far off.
 */
export function activeOrNextGroupKeyAt(
  groups: readonly LessonGroup[],
  days: readonly number[],
  config: ScheduleConfig,
  now: Date,
): string | null {
  const nowInWeek =
    daysSinceMonday(now) * MINUTES_PER_DAY +
    now.getHours() * 60 +
    now.getMinutes();

  const blocks = groups
    .map(({ key, lessons }): TimeBlock | null => {
      const first = lessons[0];
      if (!first) return null;
      const dayIndex = days.indexOf(first.day);
      if (dayIndex === -1) return null;

      const { firstSlot, lastSlot } = lessonsSlotRange(lessons);
      const { start, end } = slotRangeMinutes(
        config,
        first.day,
        firstSlot,
        lastSlot,
      );
      const dayStart = dayIndex * MINUTES_PER_DAY;
      return { key, start: dayStart + start, end: dayStart + end };
    })
    .filter((block): block is TimeBlock => block !== null);

  const active = blocks.find((b) => nowInWeek >= b.start && nowInWeek < b.end);
  if (active) return active.key;

  const next = blocks
    .filter((b) => b.start > nowInWeek)
    .sort((a, b) => a.start - b.start)[0];
  if (!next) return null;

  const lastFinished = blocks
    .filter((b) => b.end <= nowInWeek)
    .sort((a, b) => b.end - a.end)[0];
  if (
    lastFinished &&
    nowInWeek - lastFinished.end > JUST_FINISHED_MINUTES &&
    next.start - nowInWeek > NEXT_LESSON_HORIZON_MINUTES
  ) {
    return null;
  }

  return next.key;
}
