<script setup lang="ts">
import { computed } from 'vue';
import { BULLET_MARKER } from '@/common/utils/bullets';

const props = defineProps<{
  description: string;
}>();

const displayText = computed(() =>
  props.description.replace(BULLET_MARKER, '•'),
);
</script>

<template>
  <!-- prettier-ignore -->
  <div class="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-on-ghost">{{ displayText }}</div>
</template>
