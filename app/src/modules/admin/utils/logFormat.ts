export interface LogDay<T> {
  /** The local calendar day, as `YYYY-MM-DD`. */
  key: string;
  date: Date;
  entries: T[];
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Splits entries, in time order either way, into the local days they happened on. */
export function groupByDay<T>(
  entries: readonly T[],
  dateOf: (entry: T) => string,
): LogDay<T>[] {
  const days: LogDay<T>[] = [];
  for (const entry of entries) {
    const date = new Date(dateOf(entry));
    const key = localDayKey(date);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, date, entries: [entry] });
  }
  return days;
}

/** Local calendar days from `date` until `now`: 0 is today, 1 yesterday. */
export function calendarDaysAgo(date: Date, now: Date): number {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded, since a day across a daylight saving change is not 24 hours long.
  return Math.round((startOf(now) - startOf(date)) / 86_400_000);
}

/**
 * The i18n path of a stored type: `group-admin:subject:create` becomes
 * `group_admin.subject.create`.
 */
export function typeKeyPath(type: string): string {
  return type.replaceAll('-', '_').replaceAll(':', '.');
}

/** `secondFactor` becomes `Second factor`, for fields this build has no name for. */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function isIsoDateTime(value: string): boolean {
  return ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}
