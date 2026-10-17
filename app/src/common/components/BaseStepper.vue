<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue';

const props = defineProps<{
  min: number;
  max: number;
  step: number;
  decrementLabel: string;
  incrementLabel: string;
}>();

const value = defineModel<number>({ required: true });

/** Lands on a multiple of the step, so a value off the grid falls back in line. */
function stepBy(direction: 1 | -1) {
  const { min, max, step } = props;
  const stepped =
    direction === 1
      ? Math.floor(value.value / step + 1) * step
      : Math.ceil(value.value / step - 1) * step;
  value.value = Math.min(Math.max(stepped, min), max);
}
</script>

<template>
  <span
    role="group"
    class="flex items-stretch w-fit rounded-full border border-ghost-border bg-surface shadow-input"
  >
    <BaseButton
      size="sm"
      :icon="Minus"
      :disabled="value <= min"
      :aria-label="decrementLabel"
      class="rounded-r-none px-3"
      @click="stepBy(-1)"
    />
    <span aria-hidden="true" class="my-1.5 w-px bg-ghost-border" />
    <BaseButton
      size="sm"
      :icon="Plus"
      :disabled="value >= max"
      :aria-label="incrementLabel"
      class="rounded-l-none px-3"
      @click="stepBy(1)"
    />
  </span>
</template>
