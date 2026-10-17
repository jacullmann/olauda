import { describe, expect, it } from 'vitest';
import type { TaskPreferences } from '@/modules/tasks/types';
import { archivesOnItsOwn } from './archive';

const now = new Date(2026, 9, 7, 12, 0);
const dueLaterToday = new Date(2026, 9, 7, 18, 0).toISOString();
const dueTomorrow = new Date(2026, 9, 8, 8, 0).toISOString();
const dueYesterday = new Date(2026, 9, 6, 8, 0).toISOString();

const defaults: TaskPreferences = {
  archiveChecked: 'afterDueDate',
  groupByDueDate: true,
  archiveOtherCoursesPastDue: true,
};

const unmarked = { checked: false, pinned: false };
const checked = { checked: true, pinned: false };

describe('tasks archiving on their own', () => {
  it('archives checked tasks from their due day on by default', () => {
    expect(
      archivesOnItsOwn(
        { dueDate: dueLaterToday, takesCourse: true },
        checked,
        defaults,
        now,
      ),
    ).toBe(true);
    expect(
      archivesOnItsOwn(
        { dueDate: dueTomorrow, takesCourse: true },
        checked,
        defaults,
        now,
      ),
    ).toBe(false);
  });

  it('archives checked tasks right away or never as set', () => {
    const task = { dueDate: dueTomorrow, takesCourse: true };
    const always = { ...defaults, archiveChecked: 'always' as const };
    const never = { ...defaults, archiveChecked: 'never' as const };
    expect(archivesOnItsOwn(task, checked, always, now)).toBe(true);
    expect(
      archivesOnItsOwn(
        { dueDate: dueYesterday, takesCourse: true },
        checked,
        never,
        now,
      ),
    ).toBe(false);
  });

  it('archives past due tasks of other courses unless turned off', () => {
    const task = { dueDate: dueYesterday, takesCourse: false };
    expect(archivesOnItsOwn(task, unmarked, defaults, now)).toBe(true);
    expect(
      archivesOnItsOwn(
        task,
        unmarked,
        { ...defaults, archiveOtherCoursesPastDue: false },
        now,
      ),
    ).toBe(false);
    expect(
      archivesOnItsOwn(
        { dueDate: dueYesterday, takesCourse: true },
        unmarked,
        defaults,
        now,
      ),
    ).toBe(false);
  });

  it('keeps pinned tasks in the list', () => {
    const always = { ...defaults, archiveChecked: 'always' as const };
    expect(
      archivesOnItsOwn(
        { dueDate: dueYesterday, takesCourse: false },
        { checked: true, pinned: true },
        always,
        now,
      ),
    ).toBe(false);
  });
});
