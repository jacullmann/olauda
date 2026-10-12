/** Where a slice of a pie sits, as fractions of the whole circle. */
export interface PieArc {
  /** How much of the circle the slice covers, from 0 to 1. */
  fraction: number;
  /** How far round the circle the slice starts, from 0 to 1. */
  start: number;
}

/**
 * Lays values out round a circle in the order given. Negative values count as
 * none; without any value above zero there is nothing to divide, and every
 * slice is empty.
 */
export function pieArcs(values: readonly number[]): PieArc[] {
  const counted = values.map((value) => Math.max(0, value));
  const total = counted.reduce((sum, value) => sum + value, 0);

  let start = 0;
  return counted.map((value) => {
    const fraction = total > 0 ? value / total : 0;
    const arc = { fraction, start };
    start += fraction;
    return arc;
  });
}
