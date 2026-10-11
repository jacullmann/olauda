<script setup lang="ts">
import { haptic } from '@/common/utils/haptics';

/** A full-width form row that is itself the switch, labelled on the left. */
const model = defineModel<boolean>({ required: true });

defineProps<{
  label: string;
}>();

function toggle() {
  model.value = !model.value;
  haptic();
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="relative group flex items-center justify-between w-full h-10 cursor-pointer touch-target after:min-h-12"
    @click="toggle"
  >
    <span class="text-base font-normal">{{ label }}</span>
    <BaseToggle :model-value="model" decorative />
  </button>
</template>
