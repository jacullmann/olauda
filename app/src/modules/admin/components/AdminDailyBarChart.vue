<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminChartCard from './AdminChartCard.vue';

export interface DailyPoint {
  day: string;
  value: number;
}

/** How the idle readout condenses the series: counts of events add up,
 *  counts of distinct users per day do not. */
export type DailySummary = 'total' | 'average';

const props = withDefaults(
  defineProps<{
    title: string;
    points: DailyPoint[];
    summary?: DailySummary;
  }>(),
  { summary: 'total' },
);

const { t, locale } = useI18n();

const hoveredIndex = ref<number | null>(null);
const maxValue = computed(() =>
  Math.max(1, ...props.points.map((p) => p.value)),
);
const total = computed(() => props.points.reduce((sum, p) => sum + p.value, 0));

// `day` is a calendar date without a time zone; parsing it as UTC and
// formatting in UTC keeps it from shifting a day in western time zones.
function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale.value, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

const summaryText = computed(() => {
  if (props.summary === 'total') {
    return t('admin.overview.chart.total', { count: total.value });
  }
  const average = props.points.length ? total.value / props.points.length : 0;
  return t('admin.overview.chart.average', {
    value: average.toLocaleString(locale.value, { maximumFractionDigits: 1 }),
  });
});

const readout = computed(() => {
  const point =
    hoveredIndex.value === null ? null : props.points[hoveredIndex.value];
  return point ? `${formatDay(point.day)}: ${point.value}` : summaryText.value;
});
</script>

<template>
  <AdminChartCard :title="title" :readout="readout">
    <div
      class="flex items-end gap-0.5 h-24 border-b border-ghost-border"
      aria-hidden="true"
      @mouseleave="hoveredIndex = null"
    >
      <div
        v-for="(point, i) in points"
        :key="point.day"
        class="flex-1 h-full flex items-end"
        @mouseenter="hoveredIndex = i"
      >
        <!-- A rounded top shorter than its radius renders as a blurry sliver,
             so empty days get a flat stub and others at least the radius. -->
        <div
          class="w-full bg-accent transition-opacity"
          :class="[
            point.value ? 'rounded-t min-h-1' : 'h-px',
            hoveredIndex === null || hoveredIndex === i
              ? 'opacity-100'
              : 'opacity-40',
          ]"
          :style="
            point.value
              ? { height: `${(point.value / maxValue) * 100}%` }
              : undefined
          "
        />
      </div>
    </div>

    <div class="flex justify-between text-xs text-on-ghost-muted mt-1">
      <span>{{ points.length ? formatDay(points[0]!.day) : '' }}</span>
      <span>{{ points.length ? formatDay(points.at(-1)!.day) : '' }}</span>
    </div>

    <!-- Wrapped because the global table styles would undo `sr-only` on the table itself. -->
    <div class="sr-only">
      <table>
        <caption>
          {{
            title
          }}
        </caption>
        <tbody>
          <tr v-for="point in points" :key="point.day">
            <th scope="row">{{ formatDay(point.day) }}</th>
            <td>{{ point.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminChartCard>
</template>
