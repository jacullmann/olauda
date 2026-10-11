import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isUuid } from '@/common/utils/uuid';
import { parseUserAgent } from '@/common/utils/userAgent';
import type { EventSource } from '@/modules/admin/types';
import {
  calendarDaysAgo,
  humanizeKey,
  isIsoDateTime,
  typeKeyPath,
} from '@/modules/admin/utils/logFormat';

const I18N_BASE = 'admin.log';
/** Values such as `wrong_password` have a text; free text is shown as it is. */
const ENUM_VALUE = /^[a-z][a-z_]*$/i;

/** A detail of a log entry, ready to be shown as a label and its value. */
export interface LogField {
  key: string;
  label: string;
  value: string;
  /** The raw value, where `value` shortens or translates it. */
  title?: string;
  /** Ids are set apart, so they can be told from text and copied whole. */
  isId: boolean;
}

type FieldValue = Omit<LogField, 'key' | 'label'>;

/**
 * Turns the stored types and JSON details of the activity and security logs
 * into readable text. Whatever this build has no text for still shows, under
 * its stored name, so a newer server never hides anything.
 */
export function useLogFormat() {
  const i18n = useI18n();
  const { t, locale } = i18n;

  // Built once per locale rather than for each entry.
  const formats = computed(() => ({
    number: new Intl.NumberFormat(locale.value),
    dateTime: new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
    day: new Intl.DateTimeFormat(locale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    time: new Intl.DateTimeFormat(locale.value, { timeStyle: 'short' }),
  }));

  const optional = (key: string) => (i18n.te(key) ? t(key) : undefined);

  const eventLabel = (source: EventSource, type: string) =>
    optional(`${I18N_BASE}.${source}.${typeKeyPath(type)}`) ?? type;

  /** For a type whose log is not known, as when it comes from a link. */
  const anyEventLabel = (type: string) =>
    optional(`${I18N_BASE}.security.${typeKeyPath(type)}`) ??
    optional(`${I18N_BASE}.activity.${typeKeyPath(type)}`) ??
    type;

  const categoryLabel = (category: string) =>
    optional(`${I18N_BASE}.categories.${typeKeyPath(category)}`) ?? category;

  const fieldLabel = (key: string) =>
    optional(`${I18N_BASE}.fields.${key}`) ?? humanizeKey(key);

  /** Browser and system, falling back to the raw string when neither is known. */
  function deviceName(userAgent: string): string {
    const { browser, os } = parseUserAgent(userAgent);
    return [browser, os].filter(Boolean).join(' · ') || userAgent;
  }

  function formatValue(key: string, value: unknown): FieldValue {
    if (value === null || value === undefined) {
      return { value: '—', isId: false };
    }
    if (typeof value === 'boolean') {
      return { value: t(`${I18N_BASE}.${value ? 'yes' : 'no'}`), isId: false };
    }
    if (typeof value === 'number') {
      return { value: formats.value.number.format(value), isId: false };
    }
    if (typeof value === 'string') {
      if (key === 'userAgent') {
        return { value: deviceName(value), title: value, isId: false };
      }
      if (isIsoDateTime(value)) {
        return {
          value: formats.value.dateTime.format(new Date(value)),
          title: value,
          isId: false,
        };
      }
      const translated = ENUM_VALUE.test(value)
        ? optional(`${I18N_BASE}.values.${key}.${value}`)
        : undefined;
      return { value: translated ?? value, isId: isUuid(value) };
    }
    if (Array.isArray(value)) {
      if (value.some((item) => typeof item === 'object' && item !== null)) {
        return {
          value: t(`${I18N_BASE}.entries`, value.length),
          title: JSON.stringify(value),
          isId: false,
        };
      }
      return {
        value: value.map((item) => formatValue(key, item).value).join(', '),
        isId: false,
      };
    }
    const nested = Object.entries(value as Record<string, unknown>).map(
      ([nestedKey, nestedValue]) =>
        `${fieldLabel(nestedKey)}: ${formatValue(nestedKey, nestedValue).value}`,
    );
    return { value: nested.join(', ') || '—', isId: false };
  }

  function fields(details: Record<string, unknown> | null): LogField[] {
    return Object.entries(details ?? {}).map(([key, value]) => ({
      key,
      label: fieldLabel(key),
      ...formatValue(key, value),
    }));
  }

  /** "Today", "Yesterday", or the full date for anything older. */
  function dayLabel(date: Date, now = new Date()): string {
    const ago = calendarDaysAgo(date, now);
    if (ago === 0) return t(`${I18N_BASE}.today`);
    if (ago === 1) return t(`${I18N_BASE}.yesterday`);
    return formats.value.day.format(date);
  }

  const time = (iso: string) => formats.value.time.format(new Date(iso));

  return {
    eventLabel,
    anyEventLabel,
    categoryLabel,
    fields,
    deviceName,
    dayLabel,
    time,
  };
}
