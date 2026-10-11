<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import type { NowMarker } from '@/modules/schedule/utils/nowMarker';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

const props = withDefaults(
  defineProps<{
    marker: NowMarker | null;
    animated?: boolean;
  }>(),
  {
    animated: true,
  },
);

const root = useTemplateRef<HTMLElement>('root');

/** The marker's rows in the day's grid as last measured, and how far through them. */
const placement = ref<{ top: number; height: number; progress: number } | null>(
  null,
);

/**
 * Only time moves the marker along; when its row resizes, it keeps its place
 * in the row instead of sliding after it.
 */
const glides = ref(false);

// Rows size to their content, so the grid reports where each one ended up.
function place() {
  const grid = root.value?.parentElement;
  const { marker } = props;
  if (!grid || !marker) return;
  const { gridTemplateRows, rowGap } = getComputedStyle(grid);
  const heights = gridTemplateRows.split(' ').map(parseFloat);
  const gap = parseFloat(rowGap) || 0;
  const extentOf = (from: number, to: number) =>
    heights
      .slice(from - 1, to - 1)
      .reduce((sum, height) => sum + height + gap, 0);
  placement.value = {
    top: extentOf(1, marker.firstRow),
    height: extentOf(marker.firstRow, marker.lastRow + 1) - gap,
    progress: marker.progress,
  };
}
watch(
  () => props.marker,
  (_, previous) => {
    glides.value = !!previous && placement.value !== null;
    place();
  },
  { immediate: true, flush: 'post' },
);

useResizeObserver(
  () => root.value?.parentElement,
  () => {
    glides.value = false;
    place();
  },
);

/*
 * Keeps clear of the card's rounded corners, so the marker always rests on
 * its straight edge; a row too short for both corners holds it in the middle.
 */
const transform = computed(() => {
  if (!placement.value) return undefined;
  const { top, height, progress } = placement.value;
  const corner = `min(var(--radius-lg), ${height / 2}px)`;
  const edge = `max(0px, ${height}px - 2 * var(--radius-lg))`;
  return `translateY(calc(${top}px + ${corner} + ${edge} * ${progress}))`;
});
</script>

<!-- Sits on the left edge of the lesson column, where the cards begin. -->
<template>
  <div
    v-if="marker"
    ref="root"
    class="col-start-2 row-span-full pointer-events-none z-[3]"
    :class="{ 'animate-enter': animated }"
    :style="{ '--enter-delay': cellEntranceDelay(2, marker.firstRow) }"
    aria-hidden="true"
  >
    <div
      class="size-2.5 -translate-1/2 rounded-full bg-accent ring-2 ring-canvas"
      :class="{
        'transition-transform duration-700 ease-(--ease-settle)': glides,
        invisible: !transform,
      }"
      :style="{ transform }"
    />
  </div>
</template>
