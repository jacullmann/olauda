<script setup lang="ts">
import { computed } from 'vue';
import { Check, ChevronRight } from '@lucide/vue';
import type { SearchItem } from '@/modules/search/types';

const props = defineProps<{
  item: SearchItem;
  active: boolean;
  /** Lists for touch drop the hover highlight and rule off their items instead. */
  touch: boolean;
  /** Draws a rule above, inset to where the label starts, like BaseList. */
  separated: boolean;
}>();

const stateClasses = computed(() => {
  if (props.touch) {
    return [
      'active:bg-ghost-hover',
      props.separated &&
        'before:absolute before:top-0 before:left-15 before:right-4 before:border-t before:border-ghost-border',
    ];
  }
  return props.active
    ? 'bg-ghost-hover'
    : 'hover:bg-surface-highlight active:bg-surface-highlight';
});
</script>

<template>
  <div
    v-wave
    role="option"
    :aria-selected="active"
    class="relative flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
    :class="stateClasses"
  >
    <span
      v-if="item.icon || item.avatar"
      class="shrink-0 flex items-center justify-center size-8 text-on-ghost-muted"
    >
      <BaseAvatar
        v-if="item.avatar"
        :name="item.avatar.name"
        :picture="item.avatar.picture"
        :size="8"
      />
      <component :is="item.icon" v-else :size="20" />
    </span>

    <span class="flex-1 min-w-0">
      <span
        class="flex items-center gap-1 text-sm/tight font-medium text-on-ghost"
      >
        <template v-if="item.parent">
          <span class="text-on-ghost-muted truncate">{{ item.parent }}</span>
          <ChevronRight :size="14" class="shrink-0 text-on-ghost-subtle" />
        </template>
        <span class="truncate">{{ item.label }}</span>
      </span>
      <span
        v-if="item.description"
        class="block text-xs text-on-ghost-muted truncate mt-1"
        >{{ item.description }}</span
      >
    </span>

    <template v-if="item.kind === 'option'">
      <Check v-if="item.checked" :size="16" class="shrink-0 text-on-ghost" />
    </template>
    <BaseKbdGroup
      v-else-if="active && item.shortcut"
      :keys="item.shortcut"
      class="shrink-0"
    />
  </div>
</template>
