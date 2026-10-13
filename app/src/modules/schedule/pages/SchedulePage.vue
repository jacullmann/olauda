<script setup lang="ts">
import {
  ref,
  shallowRef,
  computed,
  watch,
  onActivated,
  onDeactivated,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useIsPhoneViewport } from '@/common/composables/useViewport';
import { useDismissibleNotice } from '@/modules/account/composables/useDismissibleNotice';
import { useSchedule } from '@/modules/schedule/composables/useSchedule';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import { useSchedulePager } from '@/modules/schedule/composables/useSchedulePager';
import { useWeekCache } from '@/modules/schedule/composables/useWeekCache';
import type {
  Lesson,
  LessonGroup,
  ScheduleLayout,
  ScheduleNowLabel,
  ScheduleRow,
} from '@/modules/schedule/types';
import {
  holdPendingEntrances,
  useSkeletonHandoff,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';
import { scheduleLessonRoute } from '@/modules/schedule/utils/routes';
import { lessonRowsOf } from '@/modules/schedule/utils/layout';
import {
  lessonGroupsByDay,
  lessonsSlotRange,
} from '@/modules/schedule/utils/lesson';
import {
  nowMarkerOf,
  type NowMarker,
  type RowSpan,
} from '@/modules/schedule/utils/nowMarker';
import {
  freeTimeMinutes,
  slotRangeMinutes,
  type MinuteRange,
} from '@/modules/schedule/utils/slotTimes';
import {
  isoDate,
  parseIsoDate,
  SCHOOL_DAYS,
} from '@/modules/schedule/utils/weekday';

import CoursePersonalizedViewNotice from '@/modules/courses/components/CoursePersonalizedViewNotice.vue';
import ScheduleHeader from '@/modules/schedule/components/ScheduleHeader.vue';
import ScheduleGrid from '@/modules/schedule/components/ScheduleGrid.vue';
import ScheduleBreakDivider from '@/modules/schedule/components/ScheduleBreakDivider.vue';
import ScheduleLessonGroup from '@/modules/schedule/components/ScheduleLessonGroup.vue';
import ScheduleCellSkeleton from '@/modules/schedule/components/ScheduleCellSkeleton.vue';
import ScheduleNowMarker from '@/modules/schedule/components/ScheduleNowMarker.vue';
import ScheduleFreeBlock from '@/modules/schedule/components/ScheduleFreeBlock.vue';
import ScheduleWeekNav from '@/modules/schedule/components/ScheduleWeekNav.vue';

// Pages run on past Friday into the following weeks, and back before Monday.
const dayPager = useSchedulePager();
const { hasPaged, selectedPage, goToPage, showPage, skipToPage } = dayPager;

const shownWeek = computed(() =>
  Math.floor(selectedPage.value / SCHOOL_DAYS.length),
);

const {
  isPersonalized,
  hiddenLessonCount,
  loadingSubs,
  loadingLessons,
  days,
  scheduleConfig,
  scheduleOfWeek,
  minutesToday,
  todayWeek,
  todayPage,
  activeOrNextGroupKey,
  getDisplayName,
  defaultPage,
  dateOfPage,
  pageOfDate,
  weekKeyOf,
  formatDayDate,
  formatDayHeading,
  formatWeekMonth,
  formatDayInitials,
  substitutionsFailedFor,
  retrySubstitutions,
  refresh,
} = useSchedule(shownWeek);

const { t } = useI18n();

const { settings } = usePageSettings('schedule');

const isPhone = useIsPhoneViewport();

const route = useRoute();
const router = useRouter();
const groupId = useGroupPageId();

const pageOfQueryDate = (date: unknown) => {
  if (typeof date !== 'string') return null;
  const parsed = parseIsoDate(date);
  return isoDate(parsed) === date ? pageOfDate(parsed) : null;
};

/** A linked date counts as paged to, so the loaded lessons never move off it. */
const linkedPage = pageOfQueryDate(route.query.date);

/*
 * The day first shown on a phone keeps its panel when the loaded lessons move
 * it to another day, so its skeletons crossfade into that day's lessons
 * instead of a fresh panel playing the entrance a second time.
 */
const entrancePage = ref(linkedPage ?? defaultPage.value);

const panelKey = (page: number) =>
  page === entrancePage.value ? 'entrance' : page;

const enterPage = (page: number) => {
  entrancePage.value = page;
  showPage(page);
};

if (linkedPage === null) enterPage(defaultPage.value);
else skipToPage(linkedPage);

/*
 * The URL names a date only away from what the schedule opens on: a phone
 * pages through days, a wider screen through weeks, named by their Monday.
 */
const queryDate = computed(() => {
  if (isPhone.value) {
    return selectedPage.value === defaultPage.value
      ? undefined
      : isoDate(dateOfPage(selectedPage.value));
  }
  const defaultWeek = Math.floor(defaultPage.value / days.length);
  return shownWeek.value === defaultWeek
    ? undefined
    : weekKeyOf(shownWeek.value);
});

// After the loaded lessons have moved the first page to its school day.
watch(
  queryDate,
  (date) => {
    // Kept alive behind an opened lesson, whose URL is not the schedule's.
    if (route.name !== 'group-schedule' || route.query.date === date) return;
    void router.replace({ query: { ...route.query, date } });
  },
  { immediate: true, flush: 'post' },
);

watch(loadingLessons, (loading) => {
  if (!loading && !hasPaged.value) enterPage(defaultPage.value);
});

/** The days stay selected as the weeks change. */
const shiftWeek = (weeks: -1 | 1) =>
  skipToPage(selectedPage.value + weeks * days.length);

const entranceStart = useSkeletonHandoff(loadingLessons);

/*
 * The row each slot's skeleton timed its entrance by. The loaded layout can
 * insert rows, so a lesson keeps its skeleton's timing to continue its motion.
 */
const skeletonRowOfSlot = shallowRef(new Map<number, number>());

const lessonEntranceStyle = (
  group: Lesson[],
  column: number,
  layout: ScheduleLayout,
) => {
  const slot = group[0]?.slot ?? 1;
  const row = skeletonRowOfSlot.value.get(slot) ?? layout.gridRowOfSlot(slot);
  return { '--enter-delay': cellEntranceDelay(column, row) };
};

type BreakRow = Extract<ScheduleRow, { kind: 'break' }>;

interface Divider {
  key: string;
  gridColumn: number;
  gridRow: number;
  label: string;
}

/** Free slots next to each other, sharing one cell that shows only its label. */
interface FreeBlock extends RowSpan {
  key: string;
  gridColumn: number;
  /**
   * By default from the lesson before to the lesson after, breaks around it
   * included; otherwise its slots alone.
   */
  time: MinuteRange;
  includesBreaks: boolean;
}

interface DayRows {
  dividers: Divider[];
  freeBlocks: FreeBlock[];
  /** The rows a phone labels, once the lessons are known. */
  labelledRows?: ReadonlySet<number>;
  /** The labelled rows up to the day's end, which now passes in order. */
  timeline: ScheduleRow[];
}

/*
 * A day's breaks stop at the last lesson the member attends, where the
 * closing divider takes the place of the row that follows it. A phone labels
 * only the rows its day fills: slots up to the last lesson shown and the rows
 * holding a divider.
 *
 * Filtered to the member's courses, the slots up to then without a lesson
 * read as free time; a break between two of them belongs to it and gets no
 * row on its day. Counting its breaks, free time also takes in the ones
 * right before and after it: the one before keeps its row, whose time is
 * where the free time starts, but no divider.
 */
const rowsOfDay = (
  layout: ScheduleLayout,
  day: number,
  week: number,
  column: number,
): DayRows => {
  const breakDivider = (row: BreakRow): Divider => ({
    key: `break-${column}-${row.gridRow}`,
    gridColumn: column,
    gridRow: row.gridRow,
    label: t('schedule.break', {
      minutes: row.durationMinsByDay.get(day),
    }),
  });
  const breakRows = layout.rows.filter(
    (row): row is BreakRow =>
      row.kind === 'break' && row.durationMinsByDay.has(day),
  );
  if (loadingLessons.value) {
    return {
      dividers: breakRows.map(breakDivider),
      freeBlocks: [],
      timeline: [],
    };
  }

  const { lastAttendedSlotByDay, lastShownSlotByDay, freeRunsOfDay } =
    scheduleOfWeek(week);
  const lastAttendedSlot = lastAttendedSlotByDay.get(day);
  const lastShownSlot = lastShownSlotByDay.get(day) ?? 0;
  const breaks = breakRows.filter(
    (row) => lastAttendedSlot !== undefined && row.afterSlot < lastAttendedSlot,
  );
  const dayEndRow = layout.rows.find(
    (row) => row.kind !== 'lesson' && row.afterSlot === lastAttendedSlot,
  )?.gridRow;

  const labelledRows = new Set(breaks.map((row) => row.gridRow));
  layout.rows.forEach((row) => {
    if (row.kind === 'lesson' && row.slot <= lastShownSlot) {
      labelledRows.add(row.gridRow);
    }
  });

  const countsBreaks = settings.value.includeBreaksInFreeTime;
  const freeRuns = freeRunsOfDay(day);
  const breaksStartingFreeTime = new Set(
    countsBreaks ? freeRuns.map(({ firstSlot }) => firstSlot - 1) : [],
  );
  const dividers = breaks
    .filter((row) => !breaksStartingFreeTime.has(row.afterSlot))
    .map(breakDivider);
  if (dayEndRow !== undefined) {
    labelledRows.add(dayEndRow);
    dividers.push({
      key: `day-end-${column}`,
      gridColumn: column,
      gridRow: dayEndRow,
      label: t('schedule.day_end'),
    });
  }

  const timeline =
    dayEndRow === undefined
      ? []
      : layout.rows.filter(
          (row) => row.gridRow <= dayEndRow && labelledRows.has(row.gridRow),
        );

  const freeTimeRange = countsBreaks ? freeTimeMinutes : slotRangeMinutes;
  /** The row of a break free time takes in, which it then reaches over. */
  const swallowedBreakRow = (afterSlot: number) =>
    countsBreaks
      ? layout.rows.find(
          (row) => row.kind === 'break' && row.afterSlot === afterSlot,
        )?.gridRow
      : undefined;
  const freeBlocks = freeRuns.map(({ firstSlot, lastSlot }): FreeBlock => {
    const time = freeTimeRange(scheduleConfig.value, day, firstSlot, lastSlot);
    const lessonsMinutes =
      (lastSlot - firstSlot + 1) * scheduleConfig.value.lessonDurationMins;
    return {
      key: `free-${column}-${firstSlot}`,
      gridColumn: column,
      firstRow:
        swallowedBreakRow(firstSlot - 1) ?? layout.gridRowOfSlot(firstSlot),
      lastRow: swallowedBreakRow(lastSlot) ?? layout.gridRowOfSlot(lastSlot),
      time,
      includesBreaks: time.end - time.start > lessonsMinutes,
    };
  });

  return { dividers, freeBlocks, labelledRows, timeline };
};

const shownWeekLayout = computed(
  () => scheduleOfWeek(shownWeek.value).weekLayout,
);

const dayLayoutOf = (day: number, week: number) =>
  scheduleOfWeek(week).dayLayouts.get(day) ?? scheduleOfWeek(week).weekLayout;

const weekRowsOf = useWeekCache(
  (week) =>
    new Map(
      days.map((day, dayIndex) => [
        day,
        rowsOfDay(scheduleOfWeek(week).weekLayout, day, week, dayIndex + 2),
      ]),
    ),
);

const phoneRowsOf = useWeekCache(
  (week) =>
    new Map(
      days.map((day) => [day, rowsOfDay(dayLayoutOf(day, week), day, week, 2)]),
    ),
);

const dividersOf = (day: number, week: number) =>
  (isPhone.value ? phoneRowsOf : weekRowsOf)(week).get(day)?.dividers ?? [];

const labelledRowsOf = (day: number, week: number) =>
  phoneRowsOf(week).get(day)?.labelledRows;

const lessonGroupsOfWeek = useWeekCache<ReadonlyMap<number, LessonGroup[]>>(
  (week) =>
    loadingLessons.value
      ? new Map()
      : lessonGroupsByDay(scheduleOfWeek(week).groupedLessons),
);

const freeBlocksOf = (day: number, week: number) =>
  (isPhone.value ? phoneRowsOf : weekRowsOf)(week).get(day)?.freeBlocks ?? [];

const lessonGroupsOf = (day: number, week: number) =>
  lessonGroupsOfWeek(week).get(day) ?? [];

/** Where now falls on today's page, which only a phone marks. */
const todayMarker = computed(() => {
  const page = todayPage.value;
  if (!settings.value.nowMarker || !isPhone.value || page === null) {
    return null;
  }
  const week = todayWeek.value;
  const day = days[page - week * days.length];
  if (day === undefined) return null;
  const layout = dayLayoutOf(day, week);
  const cells: RowSpan[] = [
    ...lessonGroupsOf(day, week).map(({ lessons }) => {
      const { firstSlot, lastSlot } = lessonsSlotRange(lessons);
      return {
        firstRow: layout.gridRowOfSlot(firstSlot),
        lastRow: layout.gridRowOfSlot(lastSlot),
      };
    }),
    ...freeBlocksOf(day, week),
  ];
  return nowMarkerOf(
    phoneRowsOf(week).get(day)?.timeline ?? [],
    cells,
    minutesToday.value,
  );
});

const markerOf = (day: number, week: number) =>
  week * days.length + days.indexOf(day) === todayPage.value
    ? todayMarker.value
    : null;

const isNowIn = (span: RowSpan, marker: NowMarker | null) =>
  marker?.firstRow === span.firstRow && marker.lastRow === span.lastRow;

/** Like a break's divider, free time holding now counts down on its own. */
const nowLabelOf = (day: number, week: number): ScheduleNowLabel | null => {
  const marker = markerOf(day, week);
  if (
    settings.value.nowMarkerTime === 'duration' ||
    !marker ||
    marker.labelRow === null ||
    marker.minutesLeft === null ||
    freeBlocksOf(day, week).some((block) => isNowIn(block, marker))
  ) {
    return null;
  }
  return {
    gridRow: marker.labelRow,
    text: t('schedule.minutes_short', { minutes: marker.minutesLeft }),
  };
};

/**
 * A divider now rests on stands out; a break's tells how long it has left,
 * unless set to keep its duration.
 */
const shownDivider = (
  divider: Omit<Divider, 'key'>,
  marker: NowMarker | null,
) => {
  if (
    marker?.firstRow !== divider.gridRow ||
    marker.lastRow !== divider.gridRow
  ) {
    return divider;
  }
  const minutes = marker.minutesLeft;
  const showsDuration =
    minutes === null || settings.value.nowMarkerTime === 'duration';
  return {
    ...divider,
    label: showsDuration
      ? divider.label
      : t('schedule.break_left', { minutes }),
    isNow: true,
  };
};

/**
 * Free time says how long it lasts, or once now is in it, how long it has
 * left, unless set to keep its duration.
 */
const shownFreeBlock = (
  { time, includesBreaks, ...block }: Omit<FreeBlock, 'key'>,
  marker: NowMarker | null,
) => {
  const isNow = isNowIn(block, marker);
  if (isNow && settings.value.nowMarkerTime === 'remaining') {
    return {
      ...block,
      // Without its breaks, free time ends before the next lesson starts.
      detail: t(
        settings.value.includeBreaksInFreeTime
          ? 'schedule.free_left'
          : 'schedule.free_time_left',
        { minutes: time.end - minutesToday.value },
      ),
      isNow,
    };
  }
  return {
    ...block,
    detail: t(
      includesBreaks ? 'schedule.free_with_breaks' : 'schedule.free_minutes',
      { minutes: time.end - time.start },
    ),
    isNow,
  };
};

const isActiveGroup = (key: string, week: number) =>
  settings.value.highlightNextLesson &&
  week === todayWeek.value &&
  key === activeOrNextGroupKey.value;

/** A lesson opens on the date it takes place in the week it is shown in. */
function openLesson(lesson: Lesson, week: number) {
  const date = dateOfPage(week * days.length + days.indexOf(lesson.day));
  void router.push(scheduleLessonRoute(groupId, isoDate(date), lesson.id));
}

/*
 * Kept alive while a lesson is open, so the page is where it was left on
 * return. Taken before leaving: once the lesson replaced the schedule, the
 * page is too short to still be scrolled that far.
 */
let scrollTop = 0;
onBeforeRouteLeave(() => {
  scrollTop = window.scrollY;
});

// Returning puts the page's nodes back into the document, which would restart
// their entrance, so it only plays the first time the page is shown. The
// lesson may have been changed meanwhile, so the schedule is fetched again.
const hasEntered = ref(false);
onDeactivated(() => {
  hasEntered.value = true;
});
onActivated(() => {
  window.scrollTo({ top: scrollTop, behavior: 'instant' });
  if (hasEntered.value) void refresh();
});

const personalizedNotice = useDismissibleNotice('personalizedSchedule');

const showPersonalizedNotice = computed(
  () =>
    !personalizedNotice.isDismissed.value &&
    !!isPersonalized.value &&
    hiddenLessonCount.value > 0 &&
    !loadingLessons.value,
);

const skeletonRows = computed(() =>
  loadingLessons.value ? lessonRowsOf(shownWeekLayout.value) : [],
);

watch(
  skeletonRows,
  (rows) => {
    if (!rows.length) return;
    skeletonRowOfSlot.value = new Map(
      rows.map(({ slot, gridRow }) => [slot, gridRow]),
    );
  },
  { immediate: true },
);
</script>

<template>
  <div class="p-4">
    <ScheduleHeader
      :class="{ 'animate-enter': !hasEntered }"
      :loading="loadingSubs || loadingLessons"
      :is-personalized="!!isPersonalized"
    >
      <template v-if="isPhone" #action>
        <BaseButton @click="goToPage(defaultPage)">
          {{ t('schedule.today') }}
        </BaseButton>
      </template>
    </ScheduleHeader>

    <CoursePersonalizedViewNotice
      :show="showPersonalizedNotice"
      class="my-4"
      @dismiss="personalizedNotice.dismiss"
    />

    <ScheduleWeekNav
      v-if="!isPhone"
      class="mb-2"
      :class="{ 'animate-enter': !hasEntered }"
      :label="formatWeekMonth(shownWeek)"
      @shift="shiftWeek"
      @today="skipToPage(defaultPage)"
    />

    <BaseLoadError
      v-if="substitutionsFailedFor(shownWeek)"
      class="mb-2"
      @retry="retrySubstitutions"
    >
      {{ t('schedule.errors.load_changes') }}
    </BaseLoadError>

    <ScheduleGrid
      :pager="dayPager"
      :layout="shownWeekLayout"
      :week-layout="(week) => scheduleOfWeek(week).weekLayout"
      :day-layout="dayLayoutOf"
      :labelled-rows="labelledRowsOf"
      :now-label="nowLabelOf"
      :tab-label="formatDayDate"
      :tab-caption="formatDayInitials"
      :day-heading="formatDayHeading"
      :column-date="formatDayDate"
      :panel-key="panelKey"
      :current-page="todayPage"
      :animated="!hasEntered"
    >
      <template #default="{ day, week, column, layout, animated }">
        <ScheduleBreakDivider
          v-for="{ key, ...divider } in dividersOf(day, week)"
          :key="key"
          v-bind="shownDivider(divider, markerOf(day, week))"
          :animated="animated"
        />

        <ScheduleFreeBlock
          v-for="{ key, ...block } in freeBlocksOf(day, week)"
          :key="key"
          v-bind="shownFreeBlock(block, markerOf(day, week))"
          :animated="animated"
        />

        <ScheduleNowMarker :marker="markerOf(day, week)" :animated="animated" />

        <!--
          Leaving skeletons fill their cell without sizing its row, so rows the
          loaded lessons join take their final height as the lessons appear.
        -->
        <TransitionGroup
          leave-active-class="absolute inset-0 **:min-h-0 transition-opacity duration-400 ease-out"
          leave-to-class="opacity-0"
          @before-leave="holdPendingEntrances"
        >
          <ScheduleCellSkeleton
            v-for="row in skeletonRows"
            :key="`skel-${column}-${row.slot}`"
            :grid-column="column"
            :grid-row="row.gridRow"
            :slot-number="row.slot"
            :radius="isPhone ? 'lg' : 'md'"
            :entrance-start="entranceStart"
          />
        </TransitionGroup>

        <ScheduleLessonGroup
          v-for="{ key, lessons } in lessonGroupsOf(day, week)"
          :key="key"
          v-entrance-start="entranceStart"
          :group="lessons"
          :is-active="isActiveGroup(key, week)"
          :animated="animated"
          :get-display-name="getDisplayName"
          is-clickable
          :time="layout.differingTimeOf(lessons)"
          :style="[
            layout.groupStyle(lessons, column),
            lessonEntranceStyle(lessons, column, layout),
          ]"
          @select-lesson="(lesson) => openLesson(lesson, week)"
        />
      </template>
    </ScheduleGrid>
  </div>
</template>
