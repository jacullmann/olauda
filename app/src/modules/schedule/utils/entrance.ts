const COLUMN_STAGGER_MS = 40;
const ROW_STAGGER_MS = 25;

/**
 * When a schedule cell starts its entrance: a diagonal wave from the top-left
 * corner, so the table unfolds instead of popping in at once.
 */
export function cellEntranceDelay(column: number, row: number): string {
  return `${column * COLUMN_STAGGER_MS + row * ROW_STAGGER_MS}ms`;
}
