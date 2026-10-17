/** January 2024 starts on a Monday, so its first days line up with ours. */
const MONDAY_BASED_YEAR = 2024;

/** The days a schedule shows, numbered from Monday = 1. */
export const SCHOOL_DAYS: readonly number[] = [1, 2, 3, 4, 5];

/** How far into the week a date lies, from Monday = 0 to Sunday = 6. */
export function daysSinceMonday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The locale's name for a school day numbered from Monday = 1. */
export function formatWeekday(
  day: number,
  locale: string,
  weekday: 'long' | 'short' = 'long',
): string {
  const date = new Date(Date.UTC(MONDAY_BASED_YEAR, 0, day, 12));
  return new Intl.DateTimeFormat(locale, { weekday }).format(date);
}

export const DAYS_PER_WEEK = 7;

export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

/** Midnight at the start of the week the date lies in. */
export function mondayOf(date: Date): Date {
  const monday = addDays(date, -daysSinceMonday(date));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Whole weeks from one Monday to another; a daylight saving shift rounds away. */
export function weeksBetween(fromMonday: Date, toMonday: Date): number {
  const days = (toMonday.getTime() - fromMonday.getTime()) / 86_400_000;
  return Math.round(days / DAYS_PER_WEEK);
}

/** A date as the server names a week by its Monday: YYYY-MM-DD in local time. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Midnight of a YYYY-MM-DD date in local time. */
export function parseIsoDate(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}
