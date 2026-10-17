import type { Task, TaskPreferences } from '@/modules/tasks/types';
import { isDueByEndOfToday, isPastDue } from './dueDate';

interface TaskMarksOf {
  checked: boolean;
  pinned: boolean;
}

/**
 * Mirrors the server's list filter: whether an unpinned task drops into the
 * archive without an explicit status, as the member's task settings decide.
 */
export function archivesOnItsOwn(
  task: Pick<Task, 'dueDate' | 'takesCourse'>,
  { checked, pinned }: TaskMarksOf,
  settings: Pick<
    TaskPreferences,
    'archiveChecked' | 'archiveOtherCoursesPastDue'
  >,
  now: Date = new Date(),
): boolean {
  if (pinned) return false;
  if (
    !task.takesCourse &&
    settings.archiveOtherCoursesPastDue &&
    isPastDue(task, now)
  ) {
    return true;
  }
  if (!checked) return false;
  switch (settings.archiveChecked) {
    case 'always':
      return true;
    case 'afterDueDate':
      return isDueByEndOfToday(task, now);
    case 'never':
      return false;
  }
}
