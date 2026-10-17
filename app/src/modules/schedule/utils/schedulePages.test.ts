import { describe, expect, it } from 'vitest';
import {
  dateOfPage,
  pageOf,
  pageOfDate,
  schoolDayOfDate,
  weekOfPage,
  weekStartOf,
} from './schedulePages';
import { isoDate } from './weekday';

const firstMonday = new Date(2026, 9, 12);

describe('schedule pages', () => {
  it('counts weeks from the first Monday, also backwards', () => {
    expect(isoDate(weekStartOf(firstMonday, 1))).toBe('2026-10-19');
    expect(isoDate(weekStartOf(firstMonday, -1))).toBe('2026-10-05');
  });

  it('gives each week one page per school day', () => {
    expect(pageOf(1, 2)).toBe(7);
    expect(weekOfPage(7)).toBe(1);
    expect(weekOfPage(-1)).toBe(-1);
    expect(isoDate(dateOfPage(firstMonday, 7))).toBe('2026-10-21');
    expect(isoDate(dateOfPage(firstMonday, -1))).toBe('2026-10-09');
  });

  it('shows a weekend on the Monday after it', () => {
    expect(pageOfDate(firstMonday, new Date(2026, 9, 16, 15))).toBe(4);
    expect(pageOfDate(firstMonday, new Date(2026, 9, 17))).toBe(5);
    expect(pageOfDate(firstMonday, new Date(2026, 9, 18))).toBe(5);
  });

  it('reads the school day a date names', () => {
    expect(schoolDayOfDate(firstMonday, '2026-10-21')).toEqual({
      week: 1,
      day: 3,
    });
    expect(schoolDayOfDate(firstMonday, '2026-10-17')).toBeNull();
    expect(schoolDayOfDate(firstMonday, '2026-02-30')).toBeNull();
    expect(schoolDayOfDate(firstMonday, 'soon')).toBeNull();
  });
});
