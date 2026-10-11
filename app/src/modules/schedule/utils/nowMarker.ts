import type { ScheduleRow } from '@/modules/schedule/types';
import { minutesSinceMidnight } from '@/common/utils/timeOfDay';

/** How long before the day's first time the marker appears. */
export const LEAD_MINUTES = 3;

/** Rows one cell spans, which now passes as one. */
export interface RowSpan {
  firstRow: number;
  lastRow: number;
}

export interface NowMarker extends RowSpan {
  /** How far through its rows now is; a break or the day's end holds it halfway. */
  progress: number;
  /**
   * The time label now has passed last, which counts down to the next one
   * instead; a divider holding now counts down on its own.
   */
  labelRow: number | null;
  /** Minutes until the next time comes up; none past the day's end. */
  minutesLeft: number | null;
}

const clampProgress = (progress: number) => Math.min(Math.max(progress, 0), 1);

/**
 * Where now falls along a day's rows, ordered by time. A lesson's row runs
 * from its start to whatever follows it, a cell spanning several rows from
 * its first row's start to whatever follows its last. A break outside any
 * cell holds now on its divider until the next lesson starts; the day's end
 * holds it until the day is over.
 */
export function nowMarkerOf(
  rows: readonly ScheduleRow[],
  cells: readonly RowSpan[],
  nowMinutes: number,
): NowMarker | null {
  const timed = rows.map((row) => ({
    row,
    minutes: minutesSinceMidnight(row.startTime),
  }));
  const first = timed[0];
  if (!first || nowMinutes < first.minutes - LEAD_MINUTES) return null;

  const currentIndex = timed.findLastIndex(
    ({ minutes }) => minutes <= nowMinutes,
  );
  const current = timed[currentIndex];
  const next = timed[currentIndex + 1];
  const { row } = current ?? first;

  const cell = cells.find(
    ({ firstRow, lastRow }) =>
      firstRow <= row.gridRow && row.gridRow <= lastRow,
  ) ?? { firstRow: row.gridRow, lastRow: row.gridRow };
  const holdsOnDivider =
    row.kind !== 'lesson' && cell.firstRow === cell.lastRow;
  const start =
    timed.find(({ row: { gridRow } }) => gridRow === cell.firstRow)?.minutes ??
    first.minutes;
  const end = timed.find(({ row: { gridRow } }) => gridRow > cell.lastRow);

  return {
    ...cell,
    progress:
      holdsOnDivider || !end
        ? 0.5
        : clampProgress((nowMinutes - start) / (end.minutes - start)),
    labelRow: current && !holdsOnDivider ? row.gridRow : null,
    minutesLeft: next ? next.minutes - nowMinutes : null,
  };
}
