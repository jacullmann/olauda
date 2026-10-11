<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminChartCard from './AdminChartCard.vue';
import type { WeeklyRhythm } from '@/modules/admin/types';
import {
  busiestSlot,
  intensityLevel,
  type WeekSlot,
} from '@/modules/admin/utils/weeklyRhythm';

const props = defineProps<{
  title: string;
  rhythm: WeeklyRhythm;
}>();

const I18N_BASE = 'admin.overview.weekly_rhythm';

// One hue from light to dark; the first shade marks slots without anyone.
const SHADES = [
  'bg-ghost-border',
  'bg-accent/25',
  'bg-accent/50',
  'bg-accent/75',
  'bg-accent',
] as const;
// Each label spans the six hour columns after it (`col-span-6`).
const AXIS_HOURS = [0, 6, 12, 18] as const;
// 1 January 2024 was a Monday, so day `n` of the grid is that date plus `n`.
const FIRST_MONDAY_UTC = Date.UTC(2024, 0, 1);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const { t, locale } = useI18n();

const hovered = ref<WeekSlot | null>(null);

const levels = SHADES.length - 1;
const max = computed(() => Math.max(0, ...props.rhythm.activeUsers.flat()));
const busiest = computed(() => busiestSlot(props.rhythm.activeUsers));

// Formatted in UTC so that daylight saving time never shifts a label.
const weekdayFormat = (weekday: 'short' | 'long') =>
  computed(
    () => new Intl.DateTimeFormat(locale.value, { weekday, timeZone: 'UTC' }),
  );
const shortWeekday = weekdayFormat('short');
const longWeekday = weekdayFormat('long');
const hourFormat = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, { hour: 'numeric', timeZone: 'UTC' }),
);

const weekdays = computed(() =>
  props.rhythm.activeUsers.map((_, day) => {
    const date = new Date(FIRST_MONDAY_UTC + day * MS_PER_DAY);
    return {
      short: shortWeekday.value.format(date),
      long: longWeekday.value.format(date),
    };
  }),
);

const atHour = (hour: number) =>
  new Date(FIRST_MONDAY_UTC + hour * MS_PER_HOUR);
const formatHour = (hour: number) => hourFormat.value.format(atHour(hour));
const formatHourRange = (hour: number) =>
  hourFormat.value.formatRange(atHour(hour), atHour(hour + 1));

const formatAverage = (value: number) =>
  (value / Math.max(1, props.rhythm.weeks)).toLocaleString(locale.value, {
    maximumFractionDigits: 1,
  });

const describeSlot = (slot: WeekSlot) =>
  t(`${I18N_BASE}.slot`, {
    day: weekdays.value[slot.weekday]?.long ?? '',
    hours: formatHourRange(slot.hour),
    value: formatAverage(slot.value),
  });

const readout = computed(() => {
  if (hovered.value) return describeSlot(hovered.value);
  if (!busiest.value) return t(`${I18N_BASE}.empty`);
  return t(`${I18N_BASE}.busiest`, {
    day: weekdays.value[busiest.value.weekday]?.short ?? '',
    hours: formatHourRange(busiest.value.hour),
  });
});

const shadeOf = (value: number) =>
  SHADES[intensityLevel(value, max.value, levels)];
</script>

<template>
  <AdminChartCard :title="title" :readout="readout">
    <div
      class="grid grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-0.5 items-center"
      aria-hidden="true"
      @mouseleave="hovered = null"
    >
      <template v-for="(hours, weekday) in rhythm.activeUsers" :key="weekday">
        <span class="pr-2 text-xs text-on-ghost-muted">
          {{ weekdays[weekday]?.short }}
        </span>
        <div
          v-for="(value, hour) in hours"
          :key="hour"
          class="h-4 md:h-6 rounded-sm"
          :class="[
            shadeOf(value),
            hovered?.weekday === weekday && hovered.hour === hour
              ? 'outline-2 outline-offset-1 outline-on-ghost'
              : '',
          ]"
          @mouseenter="hovered = { weekday, hour, value }"
        />
      </template>

      <span />
      <span
        v-for="hour in AXIS_HOURS"
        :key="hour"
        class="col-span-6 pt-1 text-xs text-on-ghost-muted"
      >
        {{ formatHour(hour) }}
      </span>
    </div>

    <div
      class="flex items-center justify-end gap-1 mt-2 text-xs text-on-ghost-muted"
      aria-hidden="true"
    >
      <span class="mr-1">{{ t(`${I18N_BASE}.less`) }}</span>
      <span
        v-for="shade in SHADES"
        :key="shade"
        class="size-3 rounded-sm"
        :class="shade"
      />
      <span class="ml-1">{{ t(`${I18N_BASE}.more`) }}</span>
    </div>

    <!-- Wrapped because the global table styles would undo `sr-only` on the table itself. -->
    <div class="sr-only">
      <table>
        <caption>
          {{
            title
          }}
        </caption>
        <thead>
          <tr>
            <td />
            <th v-for="hour in 24" :key="hour" scope="col">
              {{ formatHourRange(hour - 1) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(hours, weekday) in rhythm.activeUsers" :key="weekday">
            <th scope="row">{{ weekdays[weekday]?.long }}</th>
            <td v-for="(value, hour) in hours" :key="hour">
              {{ formatAverage(value) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminChartCard>
</template>
