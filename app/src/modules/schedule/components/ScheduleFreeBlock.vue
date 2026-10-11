<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

withDefaults(
  defineProps<{
    gridColumn: number;
    firstRow: number;
    lastRow: number;
    detail: string;
    /** Where now is, so it carries on from the now marker's label. */
    isNow?: boolean;
    animated?: boolean;
  }>(),
  {
    isNow: false,
    animated: true,
  },
);

const { t } = useI18n();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center text-on-ghost"
    :class="{ 'animate-enter': animated }"
    :style="{
      gridColumn,
      gridRow: `${firstRow} / ${lastRow + 1}`,
      '--enter-delay': cellEntranceDelay(gridColumn, firstRow),
    }"
  >
    <span class="text-base font-bold">{{ t('schedule.free') }}</span>
    <span
      class="text-xs tabular-nums transition-colors duration-300"
      :class="isNow ? 'text-accent font-medium' : 'text-on-ghost-muted'"
    >
      {{ detail }}
    </span>
  </div>
</template>
