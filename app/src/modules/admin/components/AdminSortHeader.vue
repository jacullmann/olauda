<script setup lang="ts" generic="TSort extends string">
import { computed } from 'vue';
import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/vue';
import type { SortOrder } from '@/modules/admin/types';

const props = defineProps<{
  label: string;
  field: TSort;
  sort: TSort;
  order: SortOrder;
}>();

const emit = defineEmits<{
  (e: 'sort', field: TSort): void;
}>();

const active = computed(() => props.sort === props.field);
const icon = computed(() => {
  if (!active.value) return ArrowUpDown;
  return props.order === 'asc' ? ArrowUp : ArrowDown;
});
const ariaSort = computed(() => {
  if (!active.value) return 'none';
  return props.order === 'asc' ? 'ascending' : 'descending';
});
</script>

<template>
  <th :aria-sort="ariaSort">
    <button
      type="button"
      class="inline-flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-on-ghost"
      :class="{ 'text-on-ghost': active }"
      @click="emit('sort', props.field)"
    >
      {{ props.label }}
      <component
        :is="icon"
        :size="14"
        :class="active ? 'opacity-100' : 'opacity-40'"
      />
    </button>
  </th>
</template>
