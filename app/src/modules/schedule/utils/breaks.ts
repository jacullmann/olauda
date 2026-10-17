import type { ScheduleBreaks, ScheduleConfig } from '@/modules/schedule/types';

/** The breaks a day has: its own, or everyone's. */
export function breaksOn(config: ScheduleConfig, day: number): ScheduleBreaks {
  return config.dayBreaks[day] ?? config.breaks;
}

/** The breaks that still follow a lesson of the day, earliest first. */
export function breaksWithin(
  breaks: ScheduleBreaks,
  totalSlots: number,
): ScheduleBreaks {
  return Object.fromEntries(
    Object.entries(breaks)
      .map(([slot, minutes]) => [Number(slot), minutes] as const)
      .filter(([slot, minutes]) => slot < totalSlots && minutes > 0)
      .sort(([a], [b]) => a - b),
  );
}

/**
 * Where a new break goes: the latest free slot right after another break, or
 * the first free slot when no break has one after it. `null` once every lesson
 * but the last is followed by a break.
 */
export function nextBreakSlot(
  breaks: ScheduleBreaks,
  totalSlots: number,
): number | null {
  const free: number[] = [];
  for (let slot = 1; slot < totalSlots; slot++) {
    if (!breaks[slot]) free.push(slot);
  }
  return free.findLast((slot) => breaks[slot - 1]) ?? free[0] ?? null;
}

export function sameBreaks(a: ScheduleBreaks, b: ScheduleBreaks): boolean {
  const aSlots = Object.keys(a);
  return (
    aSlots.length === Object.keys(b).length &&
    aSlots.every((slot) => a[Number(slot)] === b[Number(slot)])
  );
}

/** Drops breaks past the day's last lesson, and own breaks no different from everyone's. */
export function withTidyBreaks(config: ScheduleConfig): ScheduleConfig {
  return withBreaksOn(config, null, config.breaks);
}

/**
 * Sets the breaks of one day, or with `null` everyone's. A day whose breaks
 * end up the same as everyone's follows them again, so changing everyone's
 * breaks later changes its breaks too.
 */
export function withBreaksOn(
  config: ScheduleConfig,
  day: number | null,
  breaks: ScheduleBreaks,
): ScheduleConfig {
  const everyones = breaksWithin(
    day === null ? breaks : config.breaks,
    config.totalSlots,
  );
  const dayBreaks = { ...config.dayBreaks };
  if (day !== null) dayBreaks[day] = breaks;

  return {
    ...config,
    breaks: everyones,
    dayBreaks: Object.fromEntries(
      Object.entries(dayBreaks).flatMap(([ownDay, own]) => {
        const within = breaksWithin(own ?? {}, config.totalSlots);
        return sameBreaks(within, everyones) ? [] : [[ownDay, within]];
      }),
    ),
  };
}
