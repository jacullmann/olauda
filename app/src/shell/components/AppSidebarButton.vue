<script setup lang="ts">
import type { Component } from 'vue';

defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    icon?: Component;
    label?: string;
    shortcut?: string[];
    page?: boolean;
    expanded?: boolean;
    active?: boolean;
  }>(),
  {
    expanded: true,
    active: false,
    page: true,
  },
);
</script>

<template>
  <BaseTooltip
    :content="label"
    placement="right"
    :shortcut="shortcut"
    :disabled="!label"
  >
    <button
      v-wave
      v-bind="$attrs"
      class="group relative gap-0 items-center flex px-3 py-2.5 lg:p-2.5! min-h-10 min-w-10 text-on-ghost-muted hover:text-on-ghost rounded-full bg-transparent hover:bg-ghost-hover active:bg-ghost-hover transition-hover cursor-pointer outline-none w-full touch-target after:min-w-[calc(100%+24px)]"
      :class="{
        'text-on-ghost! active': active && (icon || expanded),
      }"
    >
      <span
        v-if="page"
        class="absolute transition-[max-height,width,top,opacity] duration-200 -left-2.5 group-[.active]:top-0 group-hover:top-[25%] top-[45%] bottom-0 w-0.5 opacity-0 group-[.active]:w-1 group-hover:w-1 group-[.active]:opacity-100 group-hover:opacity-100 group-[.active]:max-h-full group-hover:max-h-[50%] max-h-[10%] bg-action rounded-r-full"
      ></span>
      <span v-if="icon" class="shrink-0">
        <component :is="icon" :size="20" />
      </span>

      <span
        v-if="label"
        class="sidebar-fade text-sm/5 font-medium whitespace-nowrap ml-3"
        :class="[expanded ? 'opacity-100' : 'opacity-0', !icon ? 'ml-1!' : '']"
      >
        {{ label }}
      </span>
    </button>
  </BaseTooltip>
</template>
