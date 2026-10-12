import type { EventLogEntry, EventSource } from '@/modules/admin/types';
import { groupByDay } from './logFormat';

/**
 * The parts before the first colon of the stored types, with the logs that
 * record them. Entries of a category missing here still show unfiltered.
 */
export const EVENT_CATEGORIES = [
  { id: 'auth', sources: ['security'] },
  { id: 'account', sources: ['security'] },
  { id: 'mfa', sources: ['security', 'activity'] },
  { id: 'passkey', sources: ['security'] },
  { id: 'group', sources: ['security', 'activity'] },
  { id: 'group-admin', sources: ['activity'] },
  { id: 'admin', sources: ['security'] },
  { id: 'item', sources: ['activity'] },
  { id: 'todo', sources: ['activity'] },
  { id: 'schedule', sources: ['activity'] },
  { id: 'profile', sources: ['activity'] },
  { id: 'page', sources: ['activity'] },
] as const satisfies readonly {
  id: string;
  sources: readonly EventSource[];
}[];

export const EVENT_SOURCES = [
  'security',
  'activity',
] as const satisfies readonly EventSource[];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  return DATE_KEY.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * The instant a local calendar day (`YYYY-MM-DD`) begins, `offsetDays` later,
 * so a range of whole days can be sent as instants: up to the start of the day
 * after its last.
 */
export function localDayStart(dateKey: string, offsetDays = 0): string {
  const [year = 0, month = 1, day = 1] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day + offsetDays).toISOString();
}

/** A row of the log as it is laid out: a day's heading or one of its entries. */
export type EventLogRow =
  | { kind: 'day'; key: string; dateKey: string; date: Date }
  | {
      kind: 'entry';
      key: string;
      entry: EventLogEntry;
      /** The day's first and last entries round off the card they form. */
      isFirstOfDay: boolean;
      isLastOfDay: boolean;
    };

/** Lays the entries out under a heading for each local day they fall on. */
export function eventLogRows(entries: readonly EventLogEntry[]): EventLogRow[] {
  return groupByDay(entries, (entry) => entry.createdAt).flatMap((day) => [
    {
      kind: 'day',
      key: `day-${day.key}`,
      dateKey: day.key,
      date: day.date,
    } as const,
    ...day.entries.map((entry, index): EventLogRow => ({
      kind: 'entry',
      key: entry.id,
      entry,
      isFirstOfDay: index === 0,
      isLastOfDay: index === day.entries.length - 1,
    })),
  ]);
}
