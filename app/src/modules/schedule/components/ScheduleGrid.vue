<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  ScheduleLayout,
  ScheduleNowLabel,
} from '@/modules/schedule/types';
import {
  useSchedulePager,
  type SchedulePager,
} from '@/modules/schedule/composables/useSchedulePager';
import { useIsPhoneViewport } from '@/common/composables/useViewport';
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';

import ScheduleDayTrack from './ScheduleDayTrack.vue';
import ScheduleStartTimeColumn from './ScheduleStartTimeColumn.vue';
import ScheduleDayHeader from './ScheduleDayHeader.vue';

const props = withDefaults(
  defineProps<{
    /**
     * Pages through the days, one page per school day of each week. A pager
     * without end leads on into other weeks; the week of its selected day is
     * the one shown side by side.
     */
    pager: SchedulePager;
    /** The shown week side by side, sharing its rows. */
    layout: ScheduleLayout;
    /** Any week side by side, as it slides in or out; the shown week's rows by default. */
    weekLayout?: (week: number) => ScheduleLayout;
    /** A day on its own, as a phone shows it; the week's rows by default. */
    dayLayout?: (day: number, week: number) => ScheduleLayout;
    /** The rows a phone labels for a day; every row by default. */
    labelledRows?: (
      day: number,
      week: number,
    ) => ReadonlySet<number> | undefined;
    /** The time label a phone shows the time it is on instead, if any. */
    nowLabel?: (day: number, week: number) => ScheduleNowLabel | null;
    /** A template for every week carries no date, so the short weekday by default. */
    tabLabel?: (day: number, week: number) => string;
    tabCaption?: (day: number, week: number) => string;
    /** The heading above a phone's single day; the weekday by default. */
    dayHeading?: (day: number, week: number) => string;
    /** The date below each weekday of the week side by side; none by default. */
    columnDate?: (day: number, week: number) => string;
    panelKey?: (page: number) => PropertyKey;
    currentPage?: number | null;
    clickableDays?: boolean;
    animated?: boolean;
    bleedClass?: string;
  }>(),
  {
    dayLayout: undefined,
    weekLayout: undefined,
    labelledRows: undefined,
    nowLabel: undefined,
    tabLabel: undefined,
    tabCaption: undefined,
    dayHeading: undefined,
    columnDate: undefined,
    panelKey: undefined,
    currentPage: null,
    clickableDays: false,
    animated: true,
    bleedClass: undefined,
  },
);

const emit = defineEmits<{
  (e: 'select-day', day: number, event: MouseEvent): void;
}>();

defineSlots<{
  /** A day's cells, placed in its column on the given layout. */
  default(slotProps: {
    day: number;
    week: number;
    column: number;
    layout: ScheduleLayout;
    animated: boolean;
  }): unknown;
}>();

const { days, formatDayName } = useScheduleDisplay();
const isPhone = useIsPhoneViewport();

// The parent creates the pager once and never swaps it.
const { hasPaged, selectedPage, skipToPage } = props.pager;

const shownWeek = computed(() => Math.floor(selectedPage.value / days.length));
const isCurrent = (week: number, dayIndex: number) =>
  week * days.length + dayIndex === props.currentPage;

// A day or week paged to slides in whole instead of replaying the entrance.
const pagedAnimated = computed(() => props.animated && !hasPaged.value);

/** Slides the week side by side along as the shown week changes. */
const {
  trackRef: weekTrackRef,
  activePage: activeWeek,
  selectedPage: selectedWeek,
  incomingPage: incomingWeek,
  settling: weekSettling,
  goToPage: goToWeek,
  showPage: showWeek,
  panelStyle: weekPanelStyle,
  onPanelTransitionEnd: onWeekTransitionEnd,
} = useSchedulePager();

/*
 * Until the days are paged, the first week shown keeps its panel when the
 * selected day moves to another week, so its entrance carries on there.
 */
const entranceWeek = ref(shownWeek.value);
showWeek(shownWeek.value);

watch(shownWeek, (week) => {
  if (week === selectedWeek.value) return;
  if (hasPaged.value) {
    void goToWeek(week);
    return;
  }
  entranceWeek.value = week;
  showWeek(week);
});

// A week swiped to keeps the weekday that was selected.
watch(selectedWeek, (week) => {
  const weeksAway = week - shownWeek.value;
  if (weeksAway !== 0) skipToPage(selectedPage.value + weeksAway * days.length);
});

const weekPanels = computed(() => {
  const weeks =
    incomingWeek.value === null
      ? [activeWeek.value]
      : [activeWeek.value, incomingWeek.value];
  return weeks.map((week) => ({
    week,
    key: week === entranceWeek.value ? 'entrance' : week,
    layout: props.weekLayout?.(week) ?? props.layout,
  }));
});

const tabLabelOf = (day: number, week: number) =>
  props.tabLabel?.(day, week) ?? formatDayName(day, 'short');

const phonePanelOf = (day: number, week: number) => {
  const layout = props.dayLayout?.(day, week) ?? props.layout;
  return { layout, gridStyle: layout.gridStyle };
};

function onDayClick(day: number, event: MouseEvent) {
  if (props.clickableDays) emit('select-day', day, event);
}
</script>

<template>
  <ScheduleDayTrack
    v-if="isPhone"
    :pager="pager"
    :days="days"
    :tab-label="tabLabelOf"
    :tab-caption="tabCaption"
    :panel-of="phonePanelOf"
    :panel-key="panelKey"
    :current-page="currentPage"
    :animated="animated"
    :bleed-class="bleedClass"
  >
    <template #default="{ day, week, page, panel }">
      <ScheduleStartTimeColumn
        :rows="panel.layout.rows"
        :labelled-rows="labelledRows?.(day, week)"
        :now-label="nowLabel?.(day, week)"
        :animated="pagedAnimated"
      />

      <ScheduleDayHeader
        :key="page"
        :grid-column="2"
        standalone
        :label="dayHeading?.(day, week) ?? formatDayName(day)"
        :is-current="page === currentPage"
        :is-clickable="clickableDays"
        :animated="pagedAnimated"
        @click.stop="onDayClick(day, $event)"
      />

      <slot
        :day="day"
        :week="week"
        :column="2"
        :layout="panel.layout"
        :animated="pagedAnimated"
      />
    </template>
  </ScheduleDayTrack>

  <BaseTableWrapper v-else>
    <div
      ref="weekTrackRef"
      class="relative min-w-fit overflow-x-clip touch-pan-y"
    >
      <div
        v-for="{ week, key, layout: panelLayout } in weekPanels"
        :key="key"
        class="grid grid-cols-[2.5rem_repeat(5,minmax(9rem,1fr))] gap-2 items-stretch w-full"
        :class="[
          week === activeWeek ? 'relative' : 'absolute inset-x-0 top-0',
          { 'transition-transform duration-300 ease-out': weekSettling },
        ]"
        :style="[weekPanelStyle(week), panelLayout.gridStyle]"
        @transitionend="onWeekTransitionEnd"
      >
        <ScheduleStartTimeColumn
          :rows="panelLayout.rows"
          :animated="pagedAnimated"
        />

        <template v-for="(day, dayIndex) in days" :key="day">
          <ScheduleDayHeader
            :grid-column="dayIndex + 2"
            :label="formatDayName(day)"
            :date="columnDate?.(day, week)"
            :is-current="isCurrent(week, dayIndex)"
            :is-clickable="clickableDays"
            :animated="pagedAnimated"
            @click.stop="onDayClick(day, $event)"
          />

          <slot
            :day="day"
            :week="week"
            :column="dayIndex + 2"
            :layout="panelLayout"
            :animated="pagedAnimated"
          />
        </template>
      </div>
    </div>
  </BaseTableWrapper>
</template>
