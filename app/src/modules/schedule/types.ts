import type { StyleValue } from 'vue';

export interface Lesson {
  id: string;
  _originalId?: string;
  day: number;
  slot: number;
  duration: number;
  room: string | null;
  subjectId?: string | null;
  courseId?: string | null;
  subjects?: {
    id: string;
    name: string;
  } | null;
  courses?: {
    id: string;
    name: string;
  } | null;
  subjectAbbr?: string;
  subject?: string;
  courseName?: string;
  _original?: Lesson;
  cancelled?: boolean;
  isSubstitutedSubject?: boolean;
  /** A Dalton lesson stands in for a subject and never carries one. */
  isDalton?: boolean;
  /** Shown to the member although they take none of its courses. */
  outsideCourseSelection?: boolean;
  /** How many courses a lesson for a whole subject stands for. */
  courseCount?: number;
}

/** Lessons of the same day whose slots overlap share one cell, earliest first. */
export interface LessonGroup {
  key: string;
  day: number;
  lessons: Lesson[];
}

export interface ScheduleCourse {
  id: string;
  name: string;
}

export interface ScheduleSubject {
  id: string;
  name: string;
  courses?: ScheduleCourse[] | null;
}

/** What the time labels count while now is in a lesson, break or free time. */
export type NowMarkerTime = 'remaining' | 'duration';

export interface SchedulePreferences {
  highlightNextLesson: boolean;
  nowMarker: boolean;
  nowMarkerTime: NowMarkerTime;
  includeBreaksInFreeTime: boolean;
}

/** Minutes of break after a slot, by that slot. */
export type ScheduleBreaks = Record<number, number>;

export interface ScheduleConfig {
  startTime: string;
  totalSlots: number;
  lessonDurationMins: number;
  /** Every day's breaks, except on the days that have their own. */
  breaks: ScheduleBreaks;
  /** The days whose breaks differ, each with all of its breaks. */
  dayBreaks: Partial<Record<number, ScheduleBreaks>>;
}

export interface Substitution {
  id: string;
  lessonId: string;
  /** The Monday of the one week the change applies to, as YYYY-MM-DD. */
  weekStart: string;
  courseId?: string | null;
  day?: number;
  slot?: number;
  duration?: number;
  subject?: string;
  subjectAbbr?: string;
  room?: string | null;
  cancelled?: boolean;
  createdAt?: string;
}

export type ScheduleRow =
  | {
      kind: 'lesson';
      gridRow: number;
      slot: number;
      startTime: string;
      /** Runs into the previous slot's row without a gap between them. */
      joinsPrevious: boolean;
    }
  | {
      kind: 'break';
      gridRow: number;
      afterSlot: number;
      startTime: string;
      /** How long the break lasts on each day that shows it here. */
      durationMinsByDay: ReadonlyMap<number, number>;
    }
  | { kind: 'dayEnd'; gridRow: number; afterSlot: number; startTime: string };

export interface ScheduleLayout {
  rows: ScheduleRow[];
  gridRowOfSlot: (slot: number) => number;
  /** The grid's rows, each slot's row also named as --slot-N-row. */
  gridStyle: Record<string, string>;
  /** Places a cell of lessons in the given column, across the rows of its slots. */
  groupStyle: (
    group: readonly Lesson[],
    gridColumn: number,
  ) => Record<string, string>;
  /** When a cell takes place, if its day's times differ from those its rows show. */
  differingTimeOf: (group: readonly Lesson[]) => string | null;
}

/** A time label showing how long until the next time instead, as now passes it. */
export interface ScheduleNowLabel {
  gridRow: number;
  text: string;
}

/** What a phone shows for one day, laid out on a grid of its own. */
export interface ScheduleDayPanel {
  gridStyle?: StyleValue;
}
