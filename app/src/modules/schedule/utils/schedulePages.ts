import {
  DAYS_PER_WEEK,
  SCHOOL_DAYS,
  addDays,
  daysSinceMonday,
  isoDate,
  mondayOf,
  parseIsoDate,
  weeksBetween,
} from './weekday';

/*
 * A schedule counts weeks from the Monday of the week it was opened in, so a
 * week keeps its number while the schedule stays open. Pages count school
 * days the same way, each week holding one page per school day.
 */

export const weekStartOf = (firstMonday: Date, week: number): Date =>
  addDays(firstMonday, week * DAYS_PER_WEEK);

export const weekOfPage = (page: number): number =>
  Math.floor(page / SCHOOL_DAYS.length);

export const pageOf = (week: number, dayIndex: number): number =>
  week * SCHOOL_DAYS.length + dayIndex;

export function dateOfPage(firstMonday: Date, page: number): Date {
  const week = weekOfPage(page);
  return addDays(weekStartOf(firstMonday, week), page - pageOf(week, 0));
}

/** The page showing a date; a weekend shows the Monday after. */
export function pageOfDate(firstMonday: Date, date: Date): number {
  const week = weeksBetween(firstMonday, mondayOf(date));
  const dayIndex = daysSinceMonday(date);
  return dayIndex < SCHOOL_DAYS.length
    ? pageOf(week, dayIndex)
    : pageOf(week + 1, 0);
}

/** The school day a YYYY-MM-DD date names; null for a weekend or no date at all. */
export function schoolDayOfDate(
  firstMonday: Date,
  date: string,
): { week: number; day: number } | null {
  const parsed = parseIsoDate(date);
  const day = SCHOOL_DAYS[daysSinceMonday(parsed)];
  if (isoDate(parsed) !== date || day === undefined) return null;
  return { week: weeksBetween(firstMonday, mondayOf(parsed)), day };
}
