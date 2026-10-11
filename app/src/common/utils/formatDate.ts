/**
 * Formats a date relative to a reference date.
 * - Less than 1 week ago (and in the past/present):
 *   - 0-59s: e.g. "23s"
 *   - 1-59m: e.g. "45m"
 *   - 1-23h: e.g. "7h"
 *   - 1-6d: e.g. "1d"
 * - 1 week ago or more (or in the future):
 *   - Current year: "month-day" (e.g. "5-21" or localized "21-5")
 *   - Different year: "year-month-day" (e.g. "2025-5-21" or localized "2025-5-21" / "21-5-2025")
 *
 * @param date The date to format (Date, timestamp, or ISO string)
 * @param t Translation function (typically from vue-i18n)
 * @param referenceDate The reference date to compare against (defaults to now)
 */
export function formatDate(
  date: Date | string | number,
  t: (key: string, named?: Record<string, any>) => string,
  referenceDate: Date = new Date(),
): string {
  const parsedDate =
    typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

  // Handle invalid dates gracefully
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return '';
  }

  const diffMs = referenceDate.getTime() - parsedDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  const SEC_IN_MIN = 60;
  const SEC_IN_HOUR = 3600;
  const SEC_IN_DAY = 86400;
  const SEC_IN_WEEK = 604800;

  // If the date is in the past (or present) and less than 1 week ago
  if (diffSec >= 0 && diffSec < SEC_IN_WEEK) {
    if (diffSec < SEC_IN_MIN) {
      const seconds = Math.max(0, diffSec);
      return t('common.date.seconds', { n: seconds });
    }
    if (diffSec < SEC_IN_HOUR) {
      const minutes = Math.floor(diffSec / SEC_IN_MIN);
      return t('common.date.minutes', { n: minutes });
    }
    if (diffSec < SEC_IN_DAY) {
      const hours = Math.floor(diffSec / SEC_IN_HOUR);
      return t('common.date.hours', { n: hours });
    }
    const days = Math.floor(diffSec / SEC_IN_DAY);
    return t('common.date.days', { n: days });
  }

  // 1 week ago or more (or future dates)
  const day = parsedDate.getDate();
  const month = parsedDate.getMonth() + 1;
  const year = parsedDate.getFullYear();
  const refYear = referenceDate.getFullYear();

  if (year === refYear) {
    return t('common.date.formatMD', { month, day });
  } else {
    return t('common.date.formatYMD', { year, month, day });
  }
}
