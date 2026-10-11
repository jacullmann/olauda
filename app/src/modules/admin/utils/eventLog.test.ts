import { describe, expect, it } from 'vitest';
import type { EventLogEntry } from '@/modules/admin/types';
import { eventLogRows, isDateKey, localDayStart } from './eventLog';

function entry(id: string, createdAt: Date): EventLogEntry {
  return {
    id,
    source: 'activity',
    type: 'page:load',
    outcome: null,
    userId: null,
    userEmail: null,
    actorId: null,
    actorEmail: null,
    groupId: null,
    groupName: null,
    ipAddress: null,
    userAgent: null,
    metadata: {},
    createdAt: createdAt.toISOString(),
  };
}

describe('eventLogRows', () => {
  it('puts a heading before each day and marks where its card begins and ends', () => {
    const rows = eventLogRows([
      entry('a', new Date(2026, 9, 10, 18)),
      entry('b', new Date(2026, 9, 10, 8)),
      entry('c', new Date(2026, 9, 9, 23)),
    ]);

    expect(
      rows.map((row) =>
        row.kind === 'day'
          ? row.dateKey
          : `${row.key}:${row.isFirstOfDay}:${row.isLastOfDay}`,
      ),
    ).toEqual([
      '2026-10-10',
      'a:true:false',
      'b:false:true',
      '2026-10-09',
      'c:true:true',
    ]);
  });

  it('keys headings apart from entries', () => {
    const keys = eventLogRows([entry('x', new Date(2026, 0, 1))]).map(
      (row) => row.key,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('localDayStart', () => {
  it('is the local midnight of the day, or of a day after it', () => {
    expect(localDayStart('2026-10-11')).toBe(
      new Date(2026, 9, 11).toISOString(),
    );
    expect(localDayStart('2026-12-31', 1)).toBe(
      new Date(2027, 0, 1).toISOString(),
    );
  });
});

describe('isDateKey', () => {
  it('accepts calendar days only', () => {
    expect(isDateKey('2026-10-11')).toBe(true);
    expect(isDateKey('2026-13-40')).toBe(false);
    expect(isDateKey('11.10.2026')).toBe(false);
    expect(isDateKey('2026-10-11T00:00')).toBe(false);
  });
});
