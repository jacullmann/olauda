<script setup lang="ts">
import type { ScheduleNowLabel, ScheduleRow } from '@/modules/schedule/types';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

withDefaults(
  defineProps<{
    rows: ScheduleRow[];
    /** Rows left out keep their space but show no label. */
    labelledRows?: ReadonlySet<number>;
    nowLabel?: ScheduleNowLabel | null;
    animated?: boolean;
  }>(),
  {
    nowLabel: null,
    animated: true,
  },
);
</script>

<!--
  A row joined to the previous one reaches back over the grid's row gap and
  into the previous row, so its track shrinks and the cell spanning both rows
  ends up shorter than two separate lessons.
-->
<template>
  <div
    v-for="row in rows"
    :key="row.gridRow"
    class="flex flex-col justify-center items-center bg-transparent text-sm text-on-ghost-muted h-full whitespace-nowrap [grid-column:1]"
    :class="{
      'min-h-14.5': row.kind === 'lesson',
      '-mt-4': row.kind === 'lesson' && row.joinsPrevious,
      'animate-enter': animated,
      invisible: labelledRows && !labelledRows.has(row.gridRow),
    }"
    :style="{
      gridRow: row.gridRow,
      '--enter-delay': cellEntranceDelay(1, row.gridRow),
    }"
  >
    <span v-if="row.kind === 'lesson'" class="font-bold text-lg text-on-ghost">
      {{ row.slot }}
    </span>
    <!-- The ring widens the pill without moving the label it takes over. -->
    <span
      class="rounded-full px-0.5 min-w-11 text-center text-xs tabular-nums ring-2 transition-colors duration-300"
      :class="
        row.gridRow === nowLabel?.gridRow
          ? 'bg-accent ring-accent text-on-accent font-semibold'
          : 'ring-transparent'
      "
    >
      {{ row.gridRow === nowLabel?.gridRow ? nowLabel.text : row.startTime }}
    </span>
  </div>
</template>
