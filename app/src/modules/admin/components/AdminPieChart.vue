<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { pieArcs } from '@/modules/admin/utils/pieChart';
import AdminChartCard from './AdminChartCard.vue';

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  /** A `text-*` class; the slice and its legend dot are drawn in `currentColor`. */
  color: string;
}

const props = defineProps<{
  title: string;
  /** Disjoint parts of one whole, drawn clockwise from the top. */
  slices: PieSlice[];
  /** The readout while no slice is pointed at, e.g. the total. */
  summary: string;
}>();

const { n, locale } = useI18n();

// A circle whose circumference is 100 user units, so arc lengths are percentages.
const RADIUS = 100 / (2 * Math.PI);
const RING_WIDTH = 6;
const CENTER = RADIUS + RING_WIDTH / 2;
const VIEW_SIZE = CENTER * 2;

const hoveredKey = ref<string | null>(null);

const shares = computed(() => {
  const arcs = pieArcs(props.slices.map((slice) => slice.value));
  return props.slices.map((slice, i) => {
    const { fraction, start } = arcs[i]!;
    return {
      ...slice,
      fraction,
      dashArray: `${fraction * 100} ${100 - fraction * 100}`,
      dashOffset: -start * 100,
      percent: fraction.toLocaleString(locale.value, {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
    };
  });
});

const readout = computed(() => {
  const hovered = shares.value.find((s) => s.key === hoveredKey.value);
  return hovered
    ? `${hovered.label}: ${n(hovered.value)} (${hovered.percent})`
    : props.summary;
});

const dimmed = (key: string) =>
  hoveredKey.value !== null && hoveredKey.value !== key;
</script>

<template>
  <AdminChartCard :title="title" :readout="readout">
    <div class="flex items-center gap-5" @mouseleave="hoveredKey = null">
      <svg
        class="size-28 shrink-0 -rotate-90"
        :viewBox="`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`"
        aria-hidden="true"
      >
        <circle
          :cx="CENTER"
          :cy="CENTER"
          :r="RADIUS"
          :stroke-width="RING_WIDTH"
          class="fill-none stroke-ghost-border"
        />
        <template v-for="share in shares" :key="share.key">
          <circle
            v-if="share.fraction"
            :cx="CENTER"
            :cy="CENTER"
            :r="RADIUS"
            :stroke-width="RING_WIDTH"
            class="fill-none stroke-current transition-opacity"
            :class="[share.color, { 'opacity-40': dimmed(share.key) }]"
            :stroke-dasharray="share.dashArray"
            :stroke-dashoffset="share.dashOffset"
            pointer-events="stroke"
            @mouseenter="hoveredKey = share.key"
          />
        </template>
      </svg>

      <ul
        class="flex flex-1 min-w-0 flex-col gap-1.5 m-0 p-0 list-none text-sm"
      >
        <li
          v-for="share in shares"
          :key="share.key"
          class="flex items-center gap-2 transition-opacity"
          :class="{ 'opacity-40': dimmed(share.key) }"
          @mouseenter="hoveredKey = share.key"
        >
          <span
            class="size-2 shrink-0 rounded-full bg-current"
            :class="share.color"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 text-on-ghost-muted">
            {{ share.label }}
          </span>
          <span class="font-medium tabular-nums">{{ n(share.value) }}</span>
          <span class="w-12 text-right text-on-ghost-subtle tabular-nums">
            {{ share.percent }}
          </span>
        </li>
      </ul>
    </div>
  </AdminChartCard>
</template>
