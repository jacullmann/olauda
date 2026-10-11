<script setup lang="ts">
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

withDefaults(
  defineProps<{
    gridColumn: number;
    gridRow: number;
    label: string;
    /** Where now is, so it carries on from the now marker's label. */
    isNow?: boolean;
    animated?: boolean;
  }>(),
  {
    isNow: false,
    animated: true,
  },
);
</script>

<template>
  <div
    class="flex items-center gap-2 text-xs whitespace-nowrap tabular-nums transition-colors duration-300"
    :class="[
      isNow ? 'text-accent font-medium' : 'text-on-ghost-muted',
      { 'animate-enter': animated },
    ]"
    :style="{
      gridColumn,
      gridRow,
      '--enter-delay': cellEntranceDelay(gridColumn, gridRow),
    }"
  >
    <span
      class="h-px flex-1"
      :class="isNow ? 'bg-accent' : 'bg-ghost-border'"
    />
    {{ label }}
    <span
      class="h-px flex-1"
      :class="
        isNow ? 'bg-linear-to-r from-accent to-transparent' : 'bg-ghost-border'
      "
    />
  </div>
</template>
