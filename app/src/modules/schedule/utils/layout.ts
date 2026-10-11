import type {
  Lesson,
  LessonGroup,
  ScheduleBreaks,
  ScheduleConfig,
  ScheduleLayout,
  ScheduleRow,
} from '@/modules/schedule/types';
import { lessonsSlotRange, type SlotRange } from './lesson';
import { breaksOn } from './breaks';
import { formatMinuteRange, slotRangeMinutes } from './slotTimes';
import { formatTimeOfDay } from '@/common/utils/timeOfDay';

/** The day headers take the first row. */
const FIRST_SLOT_ROW = 2;
const MIN_CELL_HEIGHT_PX = 58;
/** Each lesson a cell stacks needs this much, so parallel courses stay legible. */
const STACKED_LESSON_HEIGHT_PX = 54;

export type LessonRow = Extract<ScheduleRow, { kind: 'lesson' }>;

export const lessonRowsOf = (layout: Pick<ScheduleLayout, 'rows'>) =>
  layout.rows.filter((row): row is LessonRow => row.kind === 'lesson');

export interface ScheduleLayoutOptions {
  /**
   * Gives each break of a day before this slot a row of its own; later
   * breaks, and all breaks by default, let lessons follow each other directly.
   */
  breaksBeforeSlot?: (day: number) => number;
  /** Slots of a day whose break lies inside free time, which takes it in instead. */
  breaksInFreeTime?: (day: number) => ReadonlySet<number>;
  /** Slots a day ends after, each followed by a row that shows when it ends. */
  dayEndSlots?: ReadonlySet<number>;
  /** Slots that run into the next one without a gap, as a cell spanning both does. */
  joinedSlots?: ReadonlySet<number>;
}

/** Slots whose boundary to the next slot lies inside a cell and on no cell's edge. */
export function slotsJoinedToNext(cells: readonly SlotRange[]): Set<number> {
  const spanned = new Set<number>();
  const edges = new Set<number>();
  for (const { firstSlot, lastSlot } of cells) {
    edges.add(firstSlot - 1);
    edges.add(lastSlot);
    for (let slot = firstSlot; slot < lastSlot; slot++) spanned.add(slot);
  }
  return spanned.difference(edges);
}

/**
 * Runs of slots up to `lastSlot` that no cell fills, earliest first. A break
 * in `splitAtBreaks` ends a run at the slot it follows.
 */
export function freeSlotRuns(
  groups: readonly LessonGroup[],
  lastSlot: number,
  splitAtBreaks: ScheduleBreaks = {},
): SlotRange[] {
  const filled = new Set<number>();
  for (const { lessons } of groups) {
    const range = lessonsSlotRange(lessons);
    for (let slot = range.firstSlot; slot <= range.lastSlot; slot++) {
      filled.add(slot);
    }
  }
  const runs: SlotRange[] = [];
  for (let slot = 1; slot <= lastSlot; slot++) {
    if (filled.has(slot)) continue;
    const run = runs.at(-1);
    const breakBefore = (splitAtBreaks[slot - 1] ?? 0) > 0;
    if (run?.lastSlot === slot - 1 && !breakBefore) run.lastSlot = slot;
    else runs.push({ firstSlot: slot, lastSlot: slot });
  }
  return runs;
}

/** The value most of `values` share; of equally common ones, the first. */
function mostCommon(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] ?? 0;
  for (const [value, count] of counts) {
    if (count > (counts.get(best) ?? 0)) best = value;
  }
  return best;
}

/*
 * Lesson rows, interleaved with breaks where shown. Days side by side share
 * their rows, so a break any of them shows gets a row, which the others leave
 * empty. A row names the time most of its days share. A day that ends where
 * no break follows gets a row of its own, so its end shows a time like a
 * break does. Start times count every break, shown or not.
 */
export function buildScheduleLayout(
  config: ScheduleConfig,
  days: readonly number[],
  {
    breaksBeforeSlot = () => 0,
    breaksInFreeTime = () => new Set(),
    dayEndSlots = new Set(),
    joinedSlots = new Set(),
  }: ScheduleLayoutOptions = {},
): ScheduleLayout {
  const rows: ScheduleRow[] = [];
  const lessonGridRows = new Map<number, number>();
  /** The time most days start each slot at, which its row names. */
  const sharedStarts = new Map<number, number>();
  let gridRow = FIRST_SLOT_ROW;
  for (let slot = 1; slot <= config.totalSlots; slot++) {
    const ranges = days.map((day) => ({
      day,
      ...slotRangeMinutes(config, day, slot),
    }));
    const start = mostCommon(ranges.map((range) => range.start));
    sharedStarts.set(slot, start);
    lessonGridRows.set(slot, gridRow);
    rows.push({
      kind: 'lesson',
      gridRow: gridRow++,
      slot,
      startTime: formatTimeOfDay(start),
      joinsPrevious:
        joinedSlots.has(slot - 1) && rows.at(-1)?.kind === 'lesson',
    });

    const durationMinsByDay = new Map(
      days.flatMap((day) => {
        const durationMins = breaksOn(config, day)[slot] ?? 0;
        const shown =
          durationMins > 0 &&
          slot < Math.min(breaksBeforeSlot(day), config.totalSlots) &&
          !breaksInFreeTime(day).has(slot);
        return shown ? [[day, durationMins] as const] : [];
      }),
    );
    if (durationMinsByDay.size > 0) {
      const breakStarts = ranges
        .filter(({ day }) => durationMinsByDay.has(day))
        .map(({ end }) => end);
      rows.push({
        kind: 'break',
        gridRow: gridRow++,
        afterSlot: slot,
        startTime: formatTimeOfDay(mostCommon(breakStarts)),
        durationMinsByDay,
      });
    } else if (dayEndSlots.has(slot)) {
      rows.push({
        kind: 'dayEnd',
        gridRow: gridRow++,
        afterSlot: slot,
        startTime: formatTimeOfDay(mostCommon(ranges.map(({ end }) => end))),
      });
    }
  }

  const gridRowOfSlot = (slot: number): number =>
    lessonGridRows.get(slot) ??
    slot + FIRST_SLOT_ROW - 1 + (rows.length - config.totalSlots);

  /*
   * Skeletons find their slot's row through the slot variables, not a fixed
   * row number: a later layout can insert rows, and a skeleton still fading
   * out would otherwise sit on the row that took its place and stretch it
   * until removed.
   */
  const gridStyle = {
    gridTemplateRows: `auto repeat(${rows.length}, auto)`,
    ...Object.fromEntries(
      [...lessonGridRows].map(([slot, row]) => [
        `--slot-${slot}-row`,
        String(row),
      ]),
    ),
  };

  const groupStyle = (group: readonly Lesson[], gridColumn: number) => {
    const { firstSlot, lastSlot } = lessonsSlotRange(group);
    const minHeight = Math.max(
      MIN_CELL_HEIGHT_PX,
      group.length * STACKED_LESSON_HEIGHT_PX,
    );
    return {
      gridColumn: String(gridColumn),
      gridRow: `${gridRowOfSlot(firstSlot)} / ${gridRowOfSlot(lastSlot) + 1}`,
      minHeight: `${minHeight}px`,
    };
  };

  const differingTimeOf = (group: readonly Lesson[]) => {
    const day = group[0]?.day;
    if (day === undefined) return null;
    const { firstSlot, lastSlot } = lessonsSlotRange(group);
    const time = slotRangeMinutes(config, day, firstSlot, lastSlot);
    const sharedEnd =
      (sharedStarts.get(lastSlot) ?? 0) + config.lessonDurationMins;
    return time.start === sharedStarts.get(firstSlot) && time.end === sharedEnd
      ? null
      : formatMinuteRange(time);
  };

  return { rows, gridRowOfSlot, gridStyle, groupStyle, differingTimeOf };
}
