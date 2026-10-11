<script setup lang="ts">
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

withDefaults(
  defineProps<{
    gridColumn: number;
    label: string;
    /** Shown below the weekday, circled on the current day. */
    date?: string;
    isCurrent?: boolean;
    isClickable?: boolean;
    animated?: boolean;
    /** A phone shows one day, so its header spans the time column and never dims. */
    standalone?: boolean;
  }>(),
  {
    date: undefined,
    isCurrent: false,
    isClickable: false,
    animated: true,
    standalone: false,
  },
);
</script>

<template>
  <div
    class="px-2 py-1 text-center font-medium text-base text-on-ghost [grid-row:1]"
    :class="[
      {
        'flex flex-col items-center gap-1': date,
        'animate-enter': animated,
        'cursor-pointer select-none transition-colors hover:text-on-ghost':
          isClickable,
      },
    ]"
    :style="{
      gridColumn: standalone ? '1 / -1' : gridColumn,
      '--enter-delay': cellEntranceDelay(gridColumn, 1),
    }"
  >
    <template v-if="date">
      <span class="text-sm text-on-ghost-muted">{{ label }}</span>
      <span
        class="flex size-10 items-center justify-center rounded-full text-lg font-bold tabular-nums"
        :class="isCurrent ? 'bg-accent text-on-accent' : 'text-on-ghost'"
        :aria-current="isCurrent ? 'date' : undefined"
      >
        {{ date }}
      </span>
    </template>
    <template v-else>{{ label }}</template>
  </div>
</template>
