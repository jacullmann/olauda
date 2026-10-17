import {
  ref,
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  type Ref,
} from 'vue';
import { useEventListener, useMounted } from '@vueuse/core';
import { useQueries, useQuery } from '@tanstack/vue-query';
import { useI18n } from 'vue-i18n';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import {
  groupOverlappingLessons,
  lessonLastSlot,
  lessonsSlotRange,
} from '@/modules/schedule/utils/lesson';
import { lessonMinutes } from '@/modules/schedule/utils/slotTimes';
import {
  buildScheduleLayout,
  freeSlotRuns,
  slotsJoinedToNext,
} from '@/modules/schedule/utils/layout';
import { breaksOn } from '@/modules/schedule/utils/breaks';
import {
  addDays,
  daysSinceMonday,
  isoDate,
  mondayOf,
  weeksBetween,
} from '@/modules/schedule/utils/weekday';
import {
  dateOfPage as dateOfPageFrom,
  pageOf,
  pageOfDate as pageOfDateFrom,
  weekOfPage,
  weekStartOf as weekStartFrom,
} from '@/modules/schedule/utils/schedulePages';
import {
  scheduleQuery,
  substitutionsQuery,
} from '@/modules/schedule/utils/scheduleQueries';
import { subjectsQuery } from '@/modules/courses/utils/courseQueries';
import { withSubstitutions } from '@/modules/schedule/utils/substitutions';
import { personalLessons } from '@/modules/schedule/utils/personalLessons';
import { activeOrNextGroupKeyAt } from '@/modules/schedule/utils/activeLesson';
import { useScheduleDisplay } from './useScheduleDisplay';
import { useWeekCache } from './useWeekCache';

const MS_PER_MINUTE = 60 * 1000;
const NO_SUBSTITUTIONS: readonly Substitution[] = [];

/**
 * The group's schedule with the changes of each week applied. The weeks of
 * today and the next school day are always loaded; `shownWeek` adds the week
 * on screen and its neighbours, so a swipe finds them ready.
 */
export function useSchedule(shownWeek?: Ref<number>) {
  const { locale, t } = useI18n();
  const userStore = useUserStore();
  const { settings: scheduleSettings } = usePageSettings('schedule');
  const {
    days,
    scheduleConfig,
    schedulesCoursesIndividually,
    formatDayName,
    getDisplayName,
  } = useScheduleDisplay();
  const groupId = useGroupPageId();
  const { findGroup } = useGroups();

  const hasCourseSelection = computed(
    () => findGroup(groupId)?.courseSetup === 'done',
  );
  const isPersonalized = computed(
    () => !!userStore.user?.personalized && hasCourseSelection.value,
  );

  /*
   * A page kept alive behind another one shares that page's queries, so only
   * the one on screen tells about a failed load.
   */
  const isShown = ref(true);
  onActivated(() => (isShown.value = true));
  onDeactivated(() => (isShown.value = false));
  const toastLoadError = (
    load: {
      error: Readonly<Ref<unknown>>;
      isLoadingError: Readonly<Ref<boolean>>;
      isSuccess: Readonly<Ref<boolean>>;
    },
    fallbackKey: string,
  ) =>
    useLoadErrorToast(
      {
        error: load.error,
        isLoadingError: computed(
          () => isShown.value && load.isLoadingError.value,
        ),
        isSuccess: load.isSuccess,
      },
      (error) => apiErrorMessage(error, t(fallbackKey)),
    );

  const scheduleResult = useQuery(scheduleQuery(groupId));
  // Without its subjects, the schedule still shows its lessons as they are.
  const subjectsResult = useQuery(subjectsQuery(groupId));

  const lessons = computed<Lesson[]>(
    () => scheduleResult.data.value?.lessons ?? [],
  );
  const loadingLessons = computed(
    () => scheduleResult.isPending.value || subjectsResult.isPending.value,
  );
  /** A failed reload keeps the schedule that is already shown. */
  const lessonsLoadError = computed(() => scheduleResult.isLoadingError.value);
  toastLoadError(scheduleResult, 'schedule.errors.load');

  function retrySchedule() {
    void scheduleResult.refetch();
    if (subjectsResult.isError.value) void subjectsResult.refetch();
  }

  const now = ref(new Date());
  const minutesToday = computed(
    () => now.value.getHours() * 60 + now.value.getMinutes(),
  );

  const firstMonday = mondayOf(now.value);
  const weekStartOf = (week: number) => weekStartFrom(firstMonday, week);
  const weekKeyOf = (week: number) => isoDate(weekStartOf(week));
  const dateOf = (day: number, week: number) =>
    addDays(weekStartOf(week), days.indexOf(day));

  const todayWeek = computed(() =>
    weeksBetween(firstMonday, mondayOf(now.value)),
  );

  const dateOfPage = (page: number) => dateOfPageFrom(firstMonday, page);
  const pageOfDate = (date: Date) => pageOfDateFrom(firstMonday, date);

  const formatDayDate = (day: number, week: number): string =>
    new Intl.DateTimeFormat(locale.value, { day: 'numeric' }).format(
      dateOf(day, week),
    );

  const formatDayHeading = (day: number, week: number): string =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(dateOf(day, week));

  // A week running into the next month names both, shortened to stay on one line.
  const formatWeekMonth = (week: number): Intl.DateTimeRangeFormatPart[] => {
    const start = weekStartOf(week);
    const end = addDays(start, days.length - 1);
    return new Intl.DateTimeFormat(locale.value, {
      month: start.getMonth() === end.getMonth() ? 'long' : 'short',
      year: 'numeric',
    }).formatRangeToParts(start, end);
  };

  // Locales abbreviate weekdays to different lengths, some with a dot; two letters keep tabs even.
  const formatDayInitials = (day: number): string =>
    formatDayName(day, 'short').slice(0, 2);

  /*
   * Each week's changes are a query of their own, so a week swiped to loads
   * only itself and a week swiped back to is still known.
   */
  // The page picks the week it opens on after this runs, during its own setup.
  const isMounted = useMounted();
  const neededWeekKeys = computed(() => {
    const weeks = [todayWeek.value, todayWeek.value + 1];
    if (shownWeek && isMounted.value) {
      weeks.push(shownWeek.value - 1, shownWeek.value, shownWeek.value + 1);
    }
    return [...new Set(weeks.map(weekKeyOf))];
  });

  const substitutionResults = useQueries({
    queries: () =>
      neededWeekKeys.value.map((weekKey) =>
        substitutionsQuery(groupId, { from: weekKey, to: weekKey }),
      ),
  });

  const substitutionResultOf = computed(
    () =>
      new Map(
        neededWeekKeys.value.map((weekKey, index) => [
          weekKey,
          substitutionResults.value[index],
        ]),
      ),
  );

  // Cached per week, so a week only rebuilds once its own changes do.
  const substitutionsOf = useWeekCache(
    (week): readonly Substitution[] =>
      substitutionResultOf.value.get(weekKeyOf(week))?.data ?? NO_SUBSTITUTIONS,
  );

  /** Whether the week's changes loaded, so an empty list really means none. */
  const substitutionsLoadedFor = (week: number) =>
    substitutionResultOf.value.get(weekKeyOf(week))?.data !== undefined;

  /** Whether the week's changes are unknown because loading them failed. */
  const substitutionsFailedFor = (week: number) =>
    !!substitutionResultOf.value.get(weekKeyOf(week))?.isLoadingError;

  const loadingSubs = computed(() =>
    substitutionResults.value.some((result) => result.isPending),
  );

  const failedSubstitutions = computed(() =>
    substitutionResults.value.filter((result) => result.isLoadingError),
  );

  // One toast per outage, not one per week swiped to while it lasts.
  toastLoadError(
    {
      error: computed(() => failedSubstitutions.value[0]?.error),
      isLoadingError: computed(() => failedSubstitutions.value.length > 0),
      isSuccess: computed(() =>
        substitutionResults.value.every((result) => result.isSuccess),
      ),
    },
    'schedule.errors.load_changes',
  );

  /** Asks again for the weeks on screen whose changes failed to load. */
  function retrySubstitutions() {
    failedSubstitutions.value.forEach((result) => void result.refetch());
  }

  const personalLessonList = computed(() =>
    personalLessons(lessons.value, subjectsResult.data.value ?? [], {
      courseIds: new Set(
        (userStore.user?.courses ?? []).map(({ courseId }) => courseId),
      ),
      hasCourseSelection: hasCourseSelection.value,
      isPersonalized: isPersonalized.value,
      schedulesCoursesIndividually: schedulesCoursesIndividually.value,
    }),
  );

  const expandedLessons = computed(() => personalLessonList.value.lessons);

  /** Lessons the member does not see because of their course selection. */
  const hiddenLessonCount = computed(
    () =>
      (scheduleResult.data.value?.hiddenByCourses ?? 0) +
      personalLessonList.value.hiddenCount,
  );

  const lastSlotByDayOf = (dayLessons: Lesson[]) => {
    const byDay = new Map<number, number>();
    dayLessons.forEach((lesson) => {
      byDay.set(
        lesson.day,
        Math.max(byDay.get(lesson.day) ?? 0, lessonLastSlot(lesson)),
      );
    });
    return byDay;
  };

  const scheduleOfWeek = useWeekCache((week) => {
    const effectiveLessons = withSubstitutions(
      expandedLessons.value,
      substitutionsOf(week),
    );
    const groupedLessons = groupOverlappingLessons(effectiveLessons);
    /** The last slot of each day that shows a lesson at all. */
    const lastShownSlotByDay = lastSlotByDayOf(effectiveLessons);
    /** The last slot of each day the member actually has to attend. */
    const lastAttendedSlotByDay = lastSlotByDayOf(
      effectiveLessons.filter(
        (lesson) => !lesson.cancelled && !lesson.outsideCourseSelection,
      ),
    );

    const freeRunsByDay = new Map(
      days.map((day) => {
        const lastAttendedSlot = lastAttendedSlotByDay.get(day);
        const runs =
          isPersonalized.value && lastAttendedSlot !== undefined
            ? freeSlotRuns(
                groupedLessons.filter((group) => group.day === day),
                lastAttendedSlot,
                scheduleSettings.value.includeBreaksInFreeTime
                  ? {}
                  : breaksOn(scheduleConfig.value, day),
              )
            : [];
        return [day, runs];
      }),
    );
    const freeRunsOfDay = (day: number) => freeRunsByDay.get(day) ?? [];

    /** The cells of a day: its lessons, and filtered, the free time between them. */
    const cellsOfDay = (day: number) => [
      ...groupedLessons
        .filter((group) => group.day === day)
        .map(({ lessons }) => lessonsSlotRange(lessons)),
      ...freeRunsOfDay(day),
    ];

    /*
     * Free time that counts its breaks also takes in the one right after it,
     * so it ends where the next lesson starts. The one right before keeps its
     * row, whose time is where the free time starts.
     */
    const takesNextBreak = scheduleSettings.value.includeBreaksInFreeTime;
    const breaksInFreeTimeByDay = new Map(
      days.map((day) => [
        day,
        new Set(
          freeRunsOfDay(day).flatMap(({ firstSlot, lastSlot }) => {
            const lastBreakSlot = takesNextBreak ? lastSlot : lastSlot - 1;
            return Array.from(
              { length: lastBreakSlot - firstSlot + 1 },
              (_, index) => firstSlot + index,
            );
          }),
        ),
      ]),
    );

    /*
     * A day shows no breaks past the last lesson the member attends, so rows
     * no day of the layout shows a break in are left out instead of staying
     * empty. While loading, every break holds its place for the skeletons.
     */
    const buildLayout = (dayList: readonly number[]) =>
      loadingLessons.value
        ? buildScheduleLayout(scheduleConfig.value, dayList, {
            breaksBeforeSlot: () => Infinity,
            dayEndSlots: new Set(),
            joinedSlots: new Set(),
          })
        : buildScheduleLayout(scheduleConfig.value, dayList, {
            breaksBeforeSlot: (day) => lastAttendedSlotByDay.get(day) ?? 0,
            breaksInFreeTime: (day) =>
              breaksInFreeTimeByDay.get(day) ?? new Set(),
            dayEndSlots: new Set(
              dayList.flatMap((day) => lastAttendedSlotByDay.get(day) ?? []),
            ),
            joinedSlots: slotsJoinedToNext(dayList.flatMap(cellsOfDay)),
          });

    return {
      effectiveLessons,
      groupedLessons,
      lastShownSlotByDay,
      lastAttendedSlotByDay,
      /** Filtered, the slots without a lesson before the day's last one. */
      freeRunsOfDay,
      /** The whole week side by side, sharing its rows. */
      weekLayout: buildLayout(days),
      /** Each day on its own, as a phone shows it. */
      dayLayouts: new Map(days.map((day) => [day, buildLayout([day])])),
    };
  });

  // Ticks on the minute, so times shown from now turn over with the clock.
  let timer: number | undefined;
  const tick = () => {
    now.value = new Date();
    timer = window.setTimeout(
      tick,
      MS_PER_MINUTE - (Date.now() % MS_PER_MINUTE),
    );
  };

  onMounted(tick);

  // A phone suspends timers in the background, so it catches up on return.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(timer);
    tick();
  });

  onUnmounted(() => {
    clearTimeout(timer);
  });

  /** Today's page, unless today is no school day. */
  const todayPage = computed(() => {
    const dayIndex = daysSinceMonday(now.value);
    return dayIndex < days.length ? pageOf(todayWeek.value, dayIndex) : null;
  });

  const isSchoolDayOver = computed(() => {
    const dayIndex = daysSinceMonday(now.value);
    const lessonsToday = scheduleOfWeek(
      todayWeek.value,
    ).effectiveLessons.filter((l) => l.day === days[dayIndex]);
    if (lessonsToday.length === 0) return false;

    const maxEndMins = Math.max(
      ...lessonsToday.map(
        (lesson) => lessonMinutes(scheduleConfig.value, lesson).end,
      ),
    );
    return minutesToday.value > maxEndMins + 10;
  });

  /** The next school day once today's lessons are over or the week is. */
  const defaultPage = computed(() => {
    const dayIndex = daysSinceMonday(now.value);
    if (dayIndex >= days.length) return pageOf(todayWeek.value + 1, 0);
    return pageOf(todayWeek.value, dayIndex + (isSchoolDayOver.value ? 1 : 0));
  });

  /** The week a glance at the schedule is about, the next one at its end. */
  const schoolWeek = computed(() => weekOfPage(defaultPage.value));
  const schoolWeekSchedule = computed(() => scheduleOfWeek(schoolWeek.value));

  const activeOrNextGroupKey = computed(() =>
    activeOrNextGroupKeyAt(
      scheduleOfWeek(todayWeek.value).groupedLessons,
      days,
      scheduleConfig.value,
      now.value,
    ),
  );

  return {
    isPersonalized,
    hiddenLessonCount,
    loadingSubs,
    loadingLessons,
    lessonsLoadError,
    retrySchedule,
    days,
    scheduleConfig,
    scheduleOfWeek,
    effectiveLessons: computed(() => schoolWeekSchedule.value.effectiveLessons),
    groupedLessons: computed(() => schoolWeekSchedule.value.groupedLessons),
    dayLayouts: computed(() => schoolWeekSchedule.value.dayLayouts),
    schoolWeekSubstitutionsFailed: computed(() =>
      substitutionsFailedFor(schoolWeek.value),
    ),
    minutesToday,
    todayWeek,
    todayPage,
    activeOrNextGroupKey,
    defaultPage,
    dateOfPage,
    pageOfDate,
    weekKeyOf,
    getDisplayName,
    formatDayName,
    formatDayDate,
    formatDayHeading,
    formatWeekMonth,
    formatDayInitials,
    lessons,
    substitutionsOf,
    substitutionsLoadedFor,
    substitutionsFailedFor,
    retrySubstitutions,
  };
}
