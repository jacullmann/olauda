<script setup lang="ts">
import { computed } from 'vue';
import { haptic } from '@/common/utils/haptics';

const model = defineModel<boolean>({ default: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    label?: string;
    disabled?: boolean;
    /**
     * Visual only, for rows that are themselves the switch: buttons can't
     * nest, and the row's `group` drives the hover and press states.
     */
    decorative?: boolean;
  }>(),
  {
    id: undefined,
    label: '',
    disabled: false,
    decorative: false,
  },
);

const toggle = () => {
  if (!props.disabled) {
    model.value = !model.value;
    haptic();
  }
};

const buttonClasses = computed(() => {
  return [
    props.decorative ? '' : 'group',
    'relative inline-flex h-6 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 touch-target after:min-h-12 after:min-w-12',
    model.value ? 'bg-accent' : 'bg-ghost',
  ];
});

const dotWrapperClasses = computed(() => {
  return [
    'pointer-events-none relative inline-block h-5 w-8 transform transition-transform duration-150 ease-in-out',
    model.value ? 'translate-x-5' : 'translate-x-0',
  ];
});

const hoverClasses = computed(() => {
  return 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-11 rounded-full bg-[oklch(0.8_0_0/40%)] opacity-0 scale-70 group-hover:opacity-100 group-hover:scale-100 group-disabled:opacity-0 transition duration-150 ease-in-out';
});

const dotClasses = computed(() => {
  return 'absolute inset-0 bg-white transform rounded-full ring-0 transition-transform scale-100 group-active:scale-80 duration-200 ease-in-out';
});
</script>

<template>
  <div class="inline-flex items-center gap-3">
    <span v-if="decorative" aria-hidden="true" :class="buttonClasses">
      <span :class="dotWrapperClasses">
        <span :class="hoverClasses"></span>
        <span :class="dotClasses"></span>
      </span>
    </span>

    <button
      v-else
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      :class="buttonClasses"
      @click="toggle"
    >
      <span v-if="label" class="sr-only">{{ label }}</span>

      <span aria-hidden="true" :class="dotWrapperClasses">
        <span :class="hoverClasses"></span>
        <span :class="dotClasses"></span>
      </span>
    </button>

    <span
      v-if="label"
      class="cursor-pointer select-none text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      @click="toggle"
    >
      {{ label }}
    </span>
  </div>
</template>
