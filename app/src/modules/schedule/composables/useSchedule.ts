import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  shallowReactive,
  watch,
  type Ref,
} from 'vue';
import { useEventListener } from '@vueuse/core';
import api from '@/api/api.ts';
import { groupPath } from '@/api/groupPath';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { hiddenByCourses } from '@/api/personalization';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useUserStore } from '@/stores/userStore';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { usePageSettings } from '@/common/composables/usePageSettings';
import type {
  Lesson,
  ScheduleSubject,
  Substitution,
} from '@/modules/schedule/types';
import { useI18n } from 'vue-i18n';
import {
  groupOverlappingLessons,
  lessonLastSlot,
  lessonsSlotRange,
  resolveLessonSubject,
  subjectsById,
} from '@/modules/schedule/utils/lesson';
import {
  lessonMinutes,
  slotRangeMinutes,
} from '@/modules/schedule/utils/slotTimes';
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
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';
import { useWeekCache } from '@/modules/schedule/composables/useWeekCache';

const MS_PER_MINUTE = 60 * 1000;
/** Back after this long, the schedule may have changed meanwhile. */
const STALE_AFTER_MS = MS_PER_MINUTE;

const isSet = <T>(value: T | null | undefined | ''): value is T =>
  value !== null && value !== undefined && value !== '';

/** The lesson as its change turns it out, keeping the original to compare. */
function applySubstitution(original: Lesson, sub: Substitution): Lesson {
  const merged: Lesson = { ...original, _original: original };
  if (isSet(sub.day)) merged.day = Number(sub.day);
  if (isSet(sub.slot)) merged.slot = sub.slot;
  if (isSet(sub.duration)) merged.duration = sub.duration;
  if (isSet(sub.room)) merged.room = sub.room;
  if (sub.cancelled) merged.cancelled = true;
  if (isSet(sub.subject)) {
    merged.subject = sub.subject;
    merged.isSubstitutedSubject = true;
  }
  if (isSet(sub.subjectAbbr)) merged.subjectAbbr = sub.subjectAbbr;
  return merged;
}

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
  const { findGroup } = useAppAuth();

  const hasCourseSelection = computed(
    () => findGroup(groupId)?.courseSetup === 'done',
  );
  const isPersonalized = computed(
    () => !!userStore.user?.personalized && hasCourseSelection.value,
  );

  const lessons = ref<Lesson[]>([]);
  const subjects = ref<ScheduleSubject[]>([]);
  /** Each loaded week's changes by its Monday; a missing week is not known yet. */
  const substitutionsByWeek = shallowReactive(
    new Map<string, Substitution[]>(),
  );
  /** Weeks whose changes failed to load and are not known from before. */
  const failedSubstitutionWeeks = shallowReactive(new Set<string>());
  const pendingSubstitutionLoads = ref(0);
  const loadingSubs = computed(() => pendingSubstitutionLoads.value > 0);
  const loadingLessons = ref(true);
  const lessonsLoadError = ref(false);
  const lessonsHiddenByServer = ref(0);

  const now = ref(new Date());
  const minutesToday = computed(
    () => now.value.getHours() * 60 + now.value.getMinutes(),
  );

  /*
   * Weeks are counted from the one the schedule was opened in, so a week keeps
   * its number while the schedule stays open. Pages count days the same way,
   * each week holding one page per school day.
   */
  const firstMonday = mondayOf(now.value);
  const weekStartOf = (week: number) => addDays(firstMonday, week * 7);
  const weekKeyOf = (week: number) => isoDate(weekStartOf(week));
  const dateOf = (day: number, week: number) =>
    addDays(weekStartOf(week), days.indexOf(day));

  const todayWeek = computed(() =>
    weeksBetween(firstMonday, mondayOf(now.value)),
  );

  const pageOf = (week: number, dayIndex: number) =>
    week * days.length + dayIndex;

  const dateOfPage = (page: number) => {
    const week = Math.floor(page / days.length);
    return addDays(weekStartOf(week), page - week * days.length);
  };

  /** The page showing a date; a weekend shows the Monday after. */
  const pageOfDate = (date: Date) => {
    const week = weeksBetween(firstMonday, mondayOf(date));
    const dayIndex = daysSinceMonday(date);
    return dayIndex < days.length
      ? pageOf(week, dayIndex)
      : pageOf(week + 1, 0);
  };

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

  /** The latest request for each week, so an older answer never overwrites a newer one. */
  const requestOfWeek = new Map<string, number>();
  let latestSubstitutionRequest = 0;

  /** `refresh` keeps the changes on screen instead of showing them as loading. */
  async function loadSubstitutions(
    fromWeek: number,
    toWeek = fromWeek,
    { refresh = false } = {},
  ) {
    const request = ++latestSubstitutionRequest;
    const weekKeys: string[] = [];
    for (let week = fromWeek; week <= toWeek; week++) {
      weekKeys.push(weekKeyOf(week));
    }
    const isLatest = (weekKey: string) =>
      requestOfWeek.get(weekKey) === request;
    weekKeys.forEach((weekKey) => requestOfWeek.set(weekKey, request));

    if (!refresh) pendingSubstitutionLoads.value++;
    try {
      const { data } = await api.get<Substitution[]>(
        groupPath(groupId, '/schedule/subs'),
        { params: { from: weekKeyOf(fromWeek), to: weekKeyOf(toWeek) } },
      );
      weekKeys.filter(isLatest).forEach((weekKey) => {
        substitutionsByWeek.set(
          weekKey,
          data.filter((sub) => sub.weekStart === weekKey),
        );
        failedSubstitutionWeeks.delete(weekKey);
      });
    } catch (error) {
      console.error('Error loading substitutions:', error);
      // Left unrequested, the weeks are asked for again once they are needed.
      const failedWeeks = weekKeys.filter(isLatest);
      failedWeeks.forEach((weekKey) => requestOfWeek.delete(weekKey));
      // A week known from before keeps showing what it had.
      const newlyFailed = failedWeeks.filter(
        (weekKey) => !substitutionsByWeek.has(weekKey),
      );
      // One toast per outage, not one per week swiped to while it lasts.
      if (newlyFailed.length > 0 && failedSubstitutionWeeks.size === 0) {
        useToast().error(
          apiErrorMessage(error, t('schedule.errors.load_changes')),
        );
      }
      newlyFailed.forEach((weekKey) => failedSubstitutionWeeks.add(weekKey));
    } finally {
      if (!refresh) pendingSubstitutionLoads.value--;
    }
  }

  const substitutionsOf = (week: number): readonly Substitution[] =>
    substitutionsByWeek.get(weekKeyOf(week)) ?? [];

  /** Whether the week's changes loaded, so an empty list really means none. */
  const substitutionsLoadedFor = (week: number) =>
    substitutionsByWeek.has(weekKeyOf(week));

  /** Whether the week's changes are unknown because loading them failed. */
  const substitutionsFailedFor = (week: number) =>
    failedSubstitutionWeeks.has(weekKeyOf(week));

  /*
   * The server filters lessons by the member's saved course setting, so a
   * setting still being saved would be answered with the old filter.
   */
  const savedCourseFilter = computed(() =>
    userStore.savingPersonalization
      ? null
      : JSON.stringify([userStore.user?.personalized, userStore.user?.courses]),
  );
  let loadedCourseFilter: string | null = null;
  let latestScheduleRequest = 0;

  /** `refresh` keeps the schedule on screen instead of its skeleton. */
  async function loadSchedule({ refresh = false } = {}) {
    const request = ++latestScheduleRequest;
    loadedCourseFilter = savedCourseFilter.value;
    if (!refresh) loadingLessons.value = true;
    try {
      const [lessonRes, subjectRes] = await Promise.all([
        api.get(groupPath(groupId, '/schedule')),
        api
          .get(groupPath(groupId, '/schedule/subjects'))
          .catch(() => ({ data: [] })),
      ]);
      if (request !== latestScheduleRequest) return;
      lessons.value = lessonRes.data;
      lessonsHiddenByServer.value = hiddenByCourses(lessonRes);
      subjects.value = subjectRes.data || [];
      lessonsLoadError.value = false;
    } catch (error) {
      if (request !== latestScheduleRequest) return;
      console.error('Error loading schedule:', error);
      // A refresh that fails leaves the schedule that is already shown.
      if (refresh) return;
      lessonsLoadError.value = true;
      useToast().error(apiErrorMessage(error, t('schedule.errors.load')));
    } finally {
      if (request === latestScheduleRequest) loadingLessons.value = false;
    }
  }

  const personalLessons = computed(() => {
    const result: Lesson[] = [];
    let hiddenCount = 0;
    if (!lessons.value || lessons.value.length === 0) {
      return { lessons: result, hiddenCount };
    }

    const subjectMap = subjectsById(subjects.value);

    const userCourses = userStore.user?.courses || [];
    const userCourseIds = new Set(userCourses.map((c: any) => c.courseId));

    lessons.value.forEach((lesson) => {
      const {
        subjectId,
        subjects: subjectRef,
        courses,
        ownCourseId,
        ownCourse,
      } = resolveLessonSubject(lesson, subjectMap);

      // A lesson scheduled for one course is already personal — Abitur groups
      // schedule nearly all of them that way.
      if (ownCourseId) {
        result.push({
          ...lesson,
          _originalId: lesson.id,
          courseId: ownCourseId,
          courseName: lesson.courseName ?? ownCourse?.name,
          courses: ownCourse,
          subjects: subjectRef,
          outsideCourseSelection:
            hasCourseSelection.value && !userCourseIds.has(ownCourseId),
        });
        return;
      }

      // Without a course the lesson covers the whole group. In an Abitur group
      // that is what it means; a regular group splits it into the member's own
      // course of that subject.
      if (!isPersonalized.value || schedulesCoursesIndividually.value) {
        result.push({
          ...lesson,
          _originalId: lesson.id,
          subjects: subjectRef,
          outsideCourseSelection:
            hasCourseSelection.value &&
            !schedulesCoursesIndividually.value &&
            courses.length > 0 &&
            !courses.some((c) => userCourseIds.has(c.id)),
        });
        return;
      }

      if (courses.length === 0) {
        result.push({ ...lesson, _originalId: lesson.id });
        return;
      }

      const ownCourses = courses.filter((c) => userCourseIds.has(c.id));
      if (ownCourses.length === 0) hiddenCount++;

      ownCourses.forEach((c) => {
        result.push({
          ...lesson,
          id: `${lesson.id}_${c.id}`,
          _originalId: lesson.id,
          courseId: c.id,
          courseName: c.name,
          courses: { id: c.id, name: c.name },
          subjectId,
          subjects: subjectRef,
        });
      });
    });

    return { lessons: result, hiddenCount };
  });

  const expandedLessons = computed(() => personalLessons.value.lessons);

  /** Lessons the member does not see because of their course selection. */
  const hiddenLessonCount = computed(
    () => lessonsHiddenByServer.value + personalLessons.value.hiddenCount,
  );

  /*
   * A lesson carries at most one change a week. Should the server still hand
   * over several, the latest wins, so a lesson never shows up twice.
   */
  const substitutionByLessonOf = (subs: readonly Substitution[]) => {
    const byLesson = new Map<string, Substitution>();
    subs.forEach((sub) => {
      const current = byLesson.get(sub.lessonId);
      if (!current || (sub.createdAt ?? '') >= (current.createdAt ?? '')) {
        byLesson.set(sub.lessonId, sub);
      }
    });
    return byLesson;
  };

  const effectiveLessonsOf = (subs: readonly Substitution[]): Lesson[] => {
    const substitutionByLesson = substitutionByLessonOf(subs);
    return expandedLessons.value.map((original) => {
      const sub = substitutionByLesson.get(original._originalId || original.id);
      const applies =
        sub && (!sub.courseId || sub.courseId === original.courseId);
      return applies
        ? applySubstitution(original, sub)
        : { ...original, _original: original };
    });
  };

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
    const effectiveLessons = effectiveLessonsOf(substitutionsOf(week));
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

  onMounted(() => {
    tick();
    void loadSchedule();
  });

  // A phone suspends timers in the background, so it catches up on return.
  // Changes made meanwhile, such as a cancelled lesson, are fetched as well.
  let hiddenSince: number | null = null;
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      hiddenSince = Date.now();
      return;
    }
    clearTimeout(timer);
    tick();
    if (hiddenSince !== null && Date.now() - hiddenSince > STALE_AFTER_MS) {
      void refresh();
    }
    hiddenSince = null;
  });

  watch(savedCourseFilter, (filter) => {
    if (filter !== null && filter !== loadedCourseFilter) void loadSchedule();
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
  const schoolWeek = computed(() =>
    Math.floor(defaultPage.value / days.length),
  );
  const schoolWeekSchedule = computed(() => scheduleOfWeek(schoolWeek.value));

  const neededWeeks = computed(() => {
    const weeks = [todayWeek.value, todayWeek.value + 1];
    if (shownWeek) {
      weeks.push(shownWeek.value - 1, shownWeek.value, shownWeek.value + 1);
    }
    return weeks;
  });

  function loadMissingSubstitutions(weeks: number[]) {
    const missing = weeks.filter((week) => !requestOfWeek.has(weekKeyOf(week)));
    if (missing.length === 0) return;
    void loadSubstitutions(Math.min(...missing), Math.max(...missing));
  }

  watch(neededWeeks, loadMissingSubstitutions, { immediate: true });

  /** Asks again for the weeks on screen whose changes failed to load. */
  function retrySubstitutions() {
    loadMissingSubstitutions(neededWeeks.value);
  }

  /** Reloads what is shown without hiding it behind skeletons meanwhile. */
  async function refresh() {
    const weekRanges: [number, number][] = [
      [todayWeek.value, todayWeek.value + 1],
    ];
    if (shownWeek) weekRanges.push([shownWeek.value - 1, shownWeek.value + 1]);
    await Promise.all([
      loadSchedule({ refresh: !lessonsLoadError.value }),
      ...weekRanges.map(([from, to]) =>
        loadSubstitutions(from, to, { refresh: true }),
      ),
    ]);
  }

  const activeOrNextGroupKey = computed<string | null>(() => {
    const currentDayIndex = daysSinceMonday(now.value);
    const currentTotalWeekMinutes =
      currentDayIndex * 24 * 60 + minutesToday.value;

    const timeBlocks = scheduleOfWeek(todayWeek.value)
      .groupedLessons.map(({ key, lessons: group }) => {
        const first = group[0];
        if (!first) return null;
        const dayIdx = days.indexOf(first.day);
        if (dayIdx === -1) return null;

        const { firstSlot, lastSlot } = lessonsSlotRange(group);
        const { start, end } = slotRangeMinutes(
          scheduleConfig.value,
          first.day,
          firstSlot,
          lastSlot,
        );
        const startTotal = dayIdx * 24 * 60 + start;
        const endTotal = dayIdx * 24 * 60 + end;

        return { key, startTotal, endTotal };
      })
      .filter(
        (
          block,
        ): block is { key: string; startTotal: number; endTotal: number } =>
          block !== null,
      );

    const activeBlock = timeBlocks.find(
      (b) =>
        currentTotalWeekMinutes >= b.startTotal &&
        currentTotalWeekMinutes < b.endTotal,
    );
    if (activeBlock) return activeBlock.key;

    const pastBlocks = timeBlocks.filter(
      (b) => b.endTotal <= currentTotalWeekMinutes,
    );
    const futureBlocks = timeBlocks.filter(
      (b) => b.startTotal > currentTotalWeekMinutes,
    );

    futureBlocks.sort((a, b) => a.startTotal - b.startTotal);
    const nextBlock = futureBlocks[0];

    if (!nextBlock) return null;

    pastBlocks.sort((a, b) => b.endTotal - a.endTotal);
    const lastFinishedBlock = pastBlocks[0];

    if (lastFinishedBlock) {
      const minutesSinceFinish =
        currentTotalWeekMinutes - lastFinishedBlock.endTotal;
      const minutesUntilNext = nextBlock.startTotal - currentTotalWeekMinutes;

      if (minutesSinceFinish > 10 && minutesUntilNext > 120) {
        return null;
      }
    }

    return nextBlock.key;
  });

  return {
    isPersonalized,
    hiddenLessonCount,
    loadingSubs,
    loadingLessons,
    lessonsLoadError,
    loadSchedule,
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
    loadSubstitutions,
  };
}
