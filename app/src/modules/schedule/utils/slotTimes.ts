import type {
  Lesson,
  ScheduleBreaks,
  ScheduleConfig,
} from '@/modules/schedule/types';
import { breaksOn } from './breaks';
import { lessonSpan } from './lesson';
import {
  DEFAULT_START_TIME,
  formatTimeOfDay,
  minutesSinceMidnight,
} from '@/common/utils/timeOfDay';

/** What a group without a configured schedule gets. */
export const DEFAULT_SCHEDULE_CONFIG: Readonly<ScheduleConfig> = {
  startTime: DEFAULT_START_TIME,
  totalSlots: 8,
  lessonDurationMins: 45,
  breaks: {},
  dayBreaks: {},
};

export function scheduleConfigOrDefault(
  config: Partial<ScheduleConfig> | null | undefined,
): ScheduleConfig {
  return {
    startTime: config?.startTime ?? DEFAULT_SCHEDULE_CONFIG.startTime,
    totalSlots: config?.totalSlots ?? DEFAULT_SCHEDULE_CONFIG.totalSlots,
    lessonDurationMins:
      config?.lessonDurationMins ?? DEFAULT_SCHEDULE_CONFIG.lessonDurationMins,
    breaks: config?.breaks ?? DEFAULT_SCHEDULE_CONFIG.breaks,
    dayBreaks: config?.dayBreaks ?? DEFAULT_SCHEDULE_CONFIG.dayBreaks,
  };
}

export type DayTimes = Pick<ScheduleConfig, 'startTime' | 'lessonDurationMins'>;

/** When a slot starts, in minutes since midnight, after every lesson and break before it. */
export function slotStartMinutesWith(
  times: DayTimes,
  breaks: ScheduleBreaks,
  slot: number,
): number {
  let minutes = minutesSinceMidnight(times.startTime);
  for (let earlierSlot = 1; earlierSlot < slot; earlierSlot++) {
    minutes += times.lessonDurationMins + (breaks[earlierSlot] || 0);
  }
  return minutes;
}

export function slotStartMinutes(
  config: ScheduleConfig,
  day: number,
  slot: number,
): number {
  return slotStartMinutesWith(config, breaksOn(config, day), slot);
}

export interface MinuteRange {
  start: number;
  end: number;
}

/** From the start of the first slot to the end of the last, breaks between them included. */
export function slotRangeMinutes(
  config: ScheduleConfig,
  day: number,
  firstSlot: number,
  lastSlot = firstSlot,
): MinuteRange {
  return {
    start: slotStartMinutes(config, day, firstSlot),
    end: slotStartMinutes(config, day, lastSlot) + config.lessonDurationMins,
  };
}

/**
 * The free time slots without a lesson leave, from the end of the slot
 * before them, or their own start, to the start of the slot after them.
 */
export function freeTimeMinutes(
  config: ScheduleConfig,
  day: number,
  firstSlot: number,
  lastSlot: number,
): MinuteRange {
  return {
    start:
      firstSlot > 1
        ? slotRangeMinutes(config, day, firstSlot - 1).end
        : slotStartMinutes(config, day, firstSlot),
    end: slotStartMinutes(config, day, lastSlot + 1),
  };
}

export function lessonMinutes(
  config: ScheduleConfig,
  lesson: Pick<Lesson, 'day' | 'slot'> & { duration?: number | null },
): MinuteRange {
  return slotRangeMinutes(
    config,
    lesson.day,
    lesson.slot,
    lesson.slot + lessonSpan(lesson) - 1,
  );
}

export function formatMinuteRange({ start, end }: MinuteRange): string {
  return `${formatTimeOfDay(start)} - ${formatTimeOfDay(end)}`;
}
