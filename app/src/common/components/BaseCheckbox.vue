<script setup lang="ts">
import { Check } from '@lucide/vue';
import { haptic } from '@/common/utils/haptics';

withDefaults(
  defineProps<{
    modelValue?: boolean;
    checked?: boolean;
    size?: 'md' | 'lg';
  }>(),
  {
    modelValue: false,
    checked: false,
    size: 'md',
  },
);

const sizeClasses = {
  md: {
    box: 'size-4.5 rounded-sm border-2',
    fill: 'inset-0 rounded-[1px]',
    hover: 'size-8.5',
    check: 'size-4',
    checkStroke: 3,
  },
  lg: {
    box: 'size-6 rounded-full border-3',
    fill: '-inset-0.5 rounded-full checkbox-bg-clip-round',
    hover: 'size-10',
    check: 'size-4',
    checkStroke: 3,
  },
} as const;

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', event: Event): void;
}>();

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  haptic();
  emit('update:modelValue', target.checked);
  emit('change', event);
}

function handleLabelClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('a')) {
    event.stopPropagation();
  }
}
</script>

<template>
  <label
    class="group inline-flex items-start gap-2 cursor-pointer select-none relative z-0"
    :class="{ 'checkbox-checked': modelValue || checked }"
  >
    <input
      type="checkbox"
      class="peer sr-only"
      :checked="modelValue || checked"
      @change="handleChange"
    />
    <span
      class="relative shrink-0 touch-target after:min-w-12 after:min-h-12 border-on-ghost-muted inline-flex items-center justify-center bg-transparent group-hover:border-action peer-checked:border-action transition-colors duration-300 ease-out"
      :class="sizeClasses[size].box"
      aria-hidden="true"
    >
      <span
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent scale-50 group-hover:bg-ghost-hover group-hover:scale-100 transition duration-150 ease-in-out z-[-1]"
        :class="sizeClasses[size].hover"
      ></span>
      <span
        class="absolute bg-action flex items-center justify-center checkbox-bg-clip"
        :class="sizeClasses[size].fill"
      >
        <Check
          class="text-on-action check-animate"
          :class="sizeClasses[size].check"
          :stroke-width="sizeClasses[size].checkStroke"
        />
      </span>
    </span>
    <span
      v-if="$slots.default"
      class="text-sm/[18px] flex-1"
      @click="handleLabelClick"
    >
      <slot></slot>
    </span>
  </label>
</template>
