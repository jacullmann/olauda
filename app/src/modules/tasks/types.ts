import type { Attachment, StoredFile, Upload } from '@/api/files';
import type { ArchiveCheckedTasks, ItemDto } from '@/api/schema';

/** A task of a group, as the API describes it. */
export type Task = ItemDto;

export type TaskType = ItemDto['type'];

/** A task type, or `all` for the list that shows every type. */
export type ItemType = TaskType | 'all';

/** What a new task's form starts out with, such as the lesson it is due in. */
export interface TaskPrefill {
  subjectId?: string;
  courseId?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
}

export type { ArchiveCheckedTasks };

export interface TaskPreferences {
  archiveChecked: ArchiveCheckedTasks;
  groupByDueDate: boolean;
  archiveOtherCoursesPastDue: boolean;
}

export function isValidType(t: unknown): t is ItemType {
  return t === 'homework' || t === 'dalton' || t === 'exam' || t === 'all';
}

export type TaskMenuAction =
  | 'images'
  | 'edit'
  | 'addNote'
  | 'pin'
  | 'archive'
  | 'share'
  | 'info'
  | 'report'
  | 'delete';

export type { Attachment, StoredFile, Upload };

/**
 * A file in the task form: an attachment of an existing task, or an upload
 * that becomes one when a new task is created.
 */
export type TaskFile = Attachment | Upload;
