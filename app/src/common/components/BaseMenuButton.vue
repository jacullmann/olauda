<script setup lang="ts">
import { ref, inject, computed } from 'vue';
import { Check, ChevronRight } from '@lucide/vue';
import type { Component } from 'vue';
import { useWindowSize } from '@vueuse/core';
import { MENU_SHEET_KEY } from '@/common/utils/menuSheet';

const sheetCtx = inject(MENU_SHEET_KEY, undefined);
const { width: vw } = useWindowSize();
const isMobile = computed(() => vw.value < 768 && !!sheetCtx);

withDefaults(
  defineProps<{
    active?: boolean;
    isSelect?: boolean;
    isSubmenu?: boolean;
    forceHover?: boolean;
    danger?: boolean;
    icon?: Component;
    disabled?: boolean;
  }>(),
  {
    danger: false,
    disabled: false,
    isSelect: false,
    isSubmenu: false,
    forceHover: false,
  },
);

const buttonEl = ref<HTMLButtonElement | null>(null);

defineExpose({
  focus: () => buttonEl.value?.focus(),
});
</script>

<template>
  <button
    ref="buttonEl"
    v-wave="!disabled"
    type="button"
    :disabled="disabled"
    class="flex justify-between items-center w-full text-left border-0 py-2 gap-4 cursor-pointer transition-hover user-select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent!"
    :class="[
      danger
        ? 'text-danger hover:bg-danger-hover active:bg-danger-hover'
        : 'text-on-ghost hover:bg-ghost-hover active:bg-ghost-hover',
      isMobile ? (icon ? 'pl-4' : 'pl-4.5') : icon ? 'pl-2.5' : 'pl-3',
      isMobile ? 'pr-4' : isSubmenu || isSelect ? 'pr-2.5' : 'pr-3',
      { 'font-semibold': active },
      isMobile ? 'rounded-xl min-h-12' : 'rounded-lg min-h-9',
    ]"
    :style="
      forceHover
        ? {
            backgroundColor: danger
              ? 'var(--color-danger-hover)'
              : 'var(--color-ghost-hover)',
          }
        : {}
    "
    :role="isSelect ? 'menuitemradio' : 'menuitem'"
    :aria-checked="isSelect ? active : undefined"
  >
    <span
      class="flex items-center"
      :class="isMobile || $slots.description ? 'gap-3' : 'gap-2'"
    >
      <slot name="icon" :size="isMobile || $slots.description ? 20 : 18">
        <component
          :is="icon"
          v-if="icon"
          :size="isMobile || $slots.description ? 20 : 18"
          class="shrink-0"
        />
      </slot>
      <span class="flex flex-col">
        <span
          class="truncate"
          :class="[
            active && !$slots.description ? 'font-bold' : 'font-medium',
            isMobile
              ? 'text-sm/6'
              : $slots.description
                ? 'text-sm/5'
                : 'text-sm/4',
          ]"
          ><slot></slot
        ></span>
        <span
          v-if="$slots.description"
          class="text-xs/4 text-on-ghost-muted font-normal"
          ><slot name="description"></slot
        ></span>
      </span>
    </span>

    <span
      v-if="isSubmenu || $slots.value"
      class="ml-auto flex items-center gap-1.5 min-w-0"
    >
      <span
        v-if="$slots.value"
        class="truncate text-on-ghost-muted font-normal"
        :class="isMobile ? 'text-sm/6' : 'text-sm/4'"
        ><slot name="value"></slot
      ></span>
      <ChevronRight
        v-if="isSubmenu"
        :size="18"
        class="shrink-0 transition-hover text-on-ghost-muted"
      />
    </span>

    <span v-if="isSelect" aria-hidden="true">
      <Check v-if="active" :size="18" class="text-on-ghost shrink-0" />
      <span v-else class="w-4 shrink-0 h-4"></span>
    </span>
  </button>
</template>
