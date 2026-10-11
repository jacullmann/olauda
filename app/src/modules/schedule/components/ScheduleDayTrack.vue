<script setup lang="ts" generic="Panel extends ScheduleDayPanel">
import { computed, watch, type ComponentPublicInstance } from 'vue';
import ScheduleDayPicker from './ScheduleDayPicker.vue';
import type { ScheduleDayPanel } from '@/modules/schedule/types';
import {
  useSchedulePager,
  type SchedulePager,
} from '@/modules/schedule/composables/useSchedulePager';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

const props = withDefaults(
  defineProps<{
    /** Pages through the days, one page per school day of each week. */
    pager: SchedulePager;
    days: readonly number[];
    tabLabel: (day: number, week: number) => string;
    tabCaption?: (day: number, week: number) => string;
    panelOf: (day: number, week: number) => Panel;
    /** Lets a panel stay mounted while its page changes; each page gets its own by default. */
    panelKey?: (page: number) => PropertyKey;
    currentPage?: number | null;
    animated?: boolean;
    /**
     * Pulls the track out through the padding around it, so days slide in
     * from the edge of the screen instead of the edge of the content.
     */
    bleedClass?: string;
  }>(),
  {
    tabCaption: undefined,
    panelKey: undefined,
    currentPage: null,
    animated: true,
    bleedClass: '-mx-4 px-4',
  },
);

defineSlots<{
  default(slotProps: {
    day: number;
    week: number;
    page: number;
    panel: Panel;
  }): unknown;
}>();

// The parent creates the pager once and never swaps it.
const {
  trackRef,
  pageCount,
  activePage,
  selectedPage,
  incomingPage,
  settling,
  goToPage,
  panelStyle,
  onPanelTransitionEnd,
} = props.pager;

const weekOf = (page: number) => Math.floor(page / props.days.length);
const dayOf = (page: number) =>
  props.days[page - weekOf(page) * props.days.length] ?? 0;

// Only days that run on without end lead from one week into the next.
const spansWeeks = pageCount === undefined;

/** Swipes the day picker a week at a time, kept on the selected day's week. */
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
showWeek(weekOf(selectedPage.value));

const bindWeekTrack = (el: Element | ComponentPublicInstance | null) => {
  weekTrackRef.value = spansWeeks && el instanceof HTMLElement ? el : null;
};

// A day reached by a swipe brings its week along the same way; one shown
// outright replaces the week as well.
watch(
  () => weekOf(selectedPage.value),
  (week) => {
    if (week === selectedWeek.value) return;
    if (incomingPage.value === null) showWeek(week);
    else void goToWeek(week);
  },
);

// Another week keeps the weekday that was picked.
watch(selectedWeek, (week) => {
  const weeksAway = week - weekOf(selectedPage.value);
  if (weeksAway === 0) return;
  void goToPage(selectedPage.value + weeksAway * props.days.length);
});

const pickerWeeks = computed(() => {
  const weeks =
    incomingWeek.value === null
      ? [activeWeek.value]
      : [activeWeek.value, incomingWeek.value];
  return weeks.map((week) => ({
    week,
    tabs: props.days.map((day, dayIndex) => {
      const page = week * props.days.length + dayIndex;
      return {
        id: String(page),
        label: props.tabLabel(day, week),
        caption: props.tabCaption?.(day, week),
        isToday: page === props.currentPage,
      };
    }),
  }));
});

const panels = computed(() => {
  const pages =
    incomingPage.value === null
      ? [activePage.value]
      : [activePage.value, incomingPage.value];
  return pages.map((page) => {
    const day = dayOf(page);
    const week = weekOf(page);
    return {
      page,
      day,
      week,
      key: props.panelKey?.(page) ?? page,
      panel: props.panelOf(day, week),
    };
  });
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="overflow-x-clip"
      :class="[bleedClass, { 'animate-enter': animated }]"
      :style="{ '--enter-delay': cellEntranceDelay(0, 1) }"
    >
      <div :ref="bindWeekTrack" class="relative touch-pan-y">
        <ScheduleDayPicker
          v-for="{ week, tabs } in pickerWeeks"
          :key="week"
          class="w-full"
          :class="[
            week === activeWeek ? 'relative' : 'absolute inset-x-0 top-0',
            { 'transition-transform duration-300 ease-out': weekSettling },
          ]"
          :style="weekPanelStyle(week)"
          :items="tabs"
          :active-id="String(selectedPage)"
          @change="(id) => goToPage(Number(id))"
          @transitionend="onWeekTransitionEnd"
        />
      </div>
    </div>

    <div class="overflow-hidden" :class="bleedClass">
      <!-- Both days share one cell, so the track holds the taller of them
           while they slide instead of cutting the incoming day off. -->
      <div ref="trackRef" class="grid touch-pan-y">
        <div
          v-for="{ page, day, week, key, panel } in panels"
          :key="key"
          :data-page="page"
          class="grid grid-cols-[2.5rem_1fr] gap-2 w-full col-start-1 row-start-1 self-start"
          :class="{ 'transition-transform duration-300 ease-out': settling }"
          :style="[panelStyle(page), panel.gridStyle]"
          @transitionend="onPanelTransitionEnd"
        >
          <slot :day="day" :week="week" :page="page" :panel="panel" />
        </div>
      </div>
    </div>
  </div>
</template>
