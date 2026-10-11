<script setup lang="ts">
import { computed, ref, watch } from 'vue';

export interface MenuOption {
  value: string;
  label: string;
  icon?: any;
}

const props = defineProps<{
  modelValue: string;
  options: MenuOption[];
  prefix?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const selectedOption = computed(() => {
  return props.options.find((o) => o.value === props.modelValue);
});

// Keyed by the first option using the same icon, so the icon only animates when it actually changes
const iconKey = computed(() =>
  props.options.findIndex((o) => o.icon === selectedOption.value?.icon),
);

// The text rolls in from the side where the new option sits in the menu
const wheelDirection = ref<'up' | 'down'>('down');

watch(
  () => props.modelValue,
  (next, prev) => {
    const nextIndex = props.options.findIndex((o) => o.value === next);
    const prevIndex = props.options.findIndex((o) => o.value === prev);
    wheelDirection.value = nextIndex < prevIndex ? 'up' : 'down';
  },
);

function selectOption(value: string) {
  emit('update:modelValue', value);
}
</script>

<template>
  <BaseSubmenu
    :label="prefix ?? selectedOption?.label"
    :icon="selectedOption?.icon"
    :disabled="disabled"
  >
    <template v-if="selectedOption?.icon" #icon="{ size }">
      <span class="swap-stack shrink-0">
        <Transition name="swap-icon">
          <component :is="selectedOption.icon" :key="iconKey" :size="size" />
        </Transition>
      </span>
    </template>

    <template #label>
      <template v-if="prefix">{{ prefix }}</template>
      <span v-else class="swap-stack">
        <Transition :name="`swap-wheel-${wheelDirection}`">
          <span :key="selectedOption?.value" class="swap-text">
            {{ selectedOption?.label }}
          </span>
        </Transition>
      </span>
    </template>

    <template v-if="prefix" #value>
      <span class="swap-stack text-right">
        <Transition :name="`swap-wheel-${wheelDirection}`">
          <span :key="selectedOption?.value" class="swap-text">
            {{ selectedOption?.label }}
          </span>
        </Transition>
      </span>
    </template>

    <BaseMenuButton
      v-for="option in options"
      :key="option.value"
      class="disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      :icon="option.icon"
      type="button"
      :disabled="disabled"
      is-select
      :active="modelValue === option.value"
      @click="selectOption(option.value)"
    >
      {{ option.label }}
    </BaseMenuButton>
  </BaseSubmenu>
</template>
