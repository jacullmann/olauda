const MS_PER_DAY = 86_400_000;

/**
 * Within half a year either way, day and month alone name exactly one date,
 * so the year can go and the weekday can take its place.
 */
const RECENT_WINDOW_DAYS = 182;

export type DueDateNameLength = 'short' | 'long';

const DISTANT_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
};

/**
 * Languages where an abbreviated weekday's period already separates it from
 * the date, making the comma Intl adds after it redundant.
 */
const COMMALESS_WEEKDAY_LANGUAGES = new Set(['de']);

function formatRecentDueDate(
  dueDate: Date,
  locale: string,
  nameLength: DueDateNameLength,
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: nameLength,
    day: 'numeric',
    month: nameLength,
  }).formatToParts(dueDate);
  if (!COMMALESS_WEEKDAY_LANGUAGES.has(new Intl.Locale(locale).language)) {
    return parts.map((part) => part.value).join('');
  }
  return parts
    .map((part, index) => {
      const previous = parts[index - 1];
      const followsAbbreviatedWeekday =
        previous?.type === 'weekday' && previous.value.endsWith('.');
      return part.type === 'literal' && followsAbbreviatedWeekday
        ? part.value.replace(',', '')
        : part.value;
    })
    .join('');
}

export function formatDueDate(
  dueDate: Date,
  locale: string,
  nameLength: DueDateNameLength,
  now: Date = new Date(),
): string {
  const distanceDays = Math.abs(dueDate.getTime() - now.getTime()) / MS_PER_DAY;
  return distanceDays <= RECENT_WINDOW_DAYS
    ? formatRecentDueDate(dueDate, locale, nameLength)
    : dueDate.toLocaleDateString(locale, DISTANT_FORMAT);
}

export function isPastDue(
  task: { dueDate: string },
  now: Date = new Date(),
): boolean {
  return new Date(task.dueDate) < now;
}

// The server's school calendar is Berlin's, whatever zone the member's device is set to.
const SCHOOL_TIME_ZONE = 'Europe/Berlin';

const schoolDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The school calendar day of an instant as YYYY-MM-DD, which sorts like the date it names. */
export const schoolDayOf = (date: Date) => schoolDayFormat.format(date);

/** Due today or earlier, by the school calendar day rather than the due time. */
export function isDueByEndOfToday(
  task: { dueDate: string },
  now: Date = new Date(),
): boolean {
  return schoolDayOf(new Date(task.dueDate)) <= schoolDayOf(now);
}
