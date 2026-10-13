import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import type { Lesson } from '@/modules/schedule/types';
import {
  formatMinuteRange,
  lessonMinutes,
} from '@/modules/schedule/utils/slotTimes';
import {
  SCHOOL_DAYS,
  daysSinceMonday,
  isoDate,
  mondayOf,
  parseIsoDate,
  weeksBetween,
} from '@/modules/schedule/utils/weekday';
import { useSchedule } from './useSchedule';

/**
 * The school day a YYYY-MM-DD date names, its week counted from this one as
 * the schedule counts weeks; null for a weekend or no date at all.
 */
function schoolDayOfDate(date: string): { week: number; day: number } | null {
  const parsed = parseIsoDate(date);
  const day = SCHOOL_DAYS[daysSinceMonday(parsed)];
  if (isoDate(parsed) !== date || day === undefined) return null;
  return { week: weeksBetween(mondayOf(new Date()), mondayOf(parsed)), day };
}

/**
 * One lesson as the schedule shows it in the week of a date, with that week's
 * changes applied. A change can move it to another day of the week, so it is
 * found anywhere in that week and tells the date it actually takes place.
 */
export function useScheduleLesson(
  date: MaybeRefOrGetter<string>,
  lessonId: MaybeRefOrGetter<string>,
) {
  const schoolDay = computed(() => schoolDayOfDate(toValue(date)));
  const week = computed(() => schoolDay.value?.week ?? 0);

  const {
    days,
    scheduleConfig,
    loadingLessons,
    lessonsLoadError,
    scheduleOfWeek,
    lessons: scheduledLessons,
    substitutionsOf,
    substitutionsLoadedFor,
    substitutionsFailedFor,
    loadSubstitutions,
    dateOfPage,
    weekKeyOf,
    formatDayHeading,
    getDisplayName,
    loadSchedule,
    retrySubstitutions,
  } = useSchedule(week);

  /** Changes can move the lesson, so it is only looked for once they are known. */
  const loading = computed(
    () =>
      loadingLessons.value ||
      (!!schoolDay.value &&
        !substitutionsLoadedFor(week.value) &&
        !substitutionsFailedFor(week.value)),
  );

  const weekLessons = computed(() =>
    schoolDay.value && !loading.value
      ? scheduleOfWeek(week.value).effectiveLessons
      : [],
  );

  // The member's courses can change while a link to the lesson is kept, which
  // turns a lesson for a whole subject into the copy for their own course.
  const lesson = computed((): Lesson | null => {
    const id = toValue(lessonId);
    const sameLesson = weekLessons.value.filter(
      (candidate) => (candidate._originalId ?? candidate.id) === id,
    );
    return (
      weekLessons.value.find((candidate) => candidate.id === id) ??
      sameLesson.find(({ day }) => day === schoolDay.value?.day) ??
      sameLesson[0] ??
      null
    );
  });

  const lessonDate = computed(() => {
    if (!lesson.value) return null;
    const page = week.value * days.length + days.indexOf(lesson.value.day);
    return isoDate(dateOfPage(page));
  });

  const dayLessons = computed(() =>
    weekLessons.value.filter(({ day }) => day === lesson.value?.day),
  );

  const dayHeading = computed(() =>
    lesson.value ? formatDayHeading(lesson.value.day, week.value) : '',
  );

  const time = computed(() =>
    lesson.value
      ? formatMinuteRange(lessonMinutes(scheduleConfig.value, lesson.value))
      : '',
  );

  /*
   * A change targets the lesson as the weekly schedule holds it, not the copy
   * split off for the member's own course or already showing earlier changes.
   */
  const scheduledLesson = computed(() => {
    const scheduledId = lesson.value?._originalId ?? lesson.value?.id;
    return scheduledLessons.value.find(({ id }) => id === scheduledId) ?? null;
  });

  const scheduledDayHeading = computed(() =>
    scheduledLesson.value
      ? formatDayHeading(scheduledLesson.value.day, week.value)
      : '',
  );

  const existingChange = computed(
    () =>
      substitutionsOf(week.value).find(
        (sub) => sub.lessonId === scheduledLesson.value?.id,
      ) ?? null,
  );

  /*
   * The change form opens with the existing change filled in, so the lesson
   * can only be changed once its week's changes are known; otherwise saving
   * would silently replace a change the form never showed.
   */
  const changesLoaded = computed(() => substitutionsLoadedFor(week.value));

  const reloadChanges = () =>
    loadSubstitutions(week.value, week.value, { refresh: true });

  return {
    week,
    weekStart: computed(() => weekKeyOf(week.value)),
    loading,
    loadError: lessonsLoadError,
    loadSchedule,
    retrySubstitutions,
    getDisplayName,
    changesFailed: computed(() => substitutionsFailedFor(week.value)),
    lesson,
    lessonDate,
    dayLessons,
    dayHeading,
    time,
    scheduledLesson,
    scheduledDayHeading,
    existingChange,
    changesLoaded,
    reloadChanges,
  };
}
