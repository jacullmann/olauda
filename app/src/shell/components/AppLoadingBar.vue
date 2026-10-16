<script setup lang="ts">
import { useLoadingBar } from '@/shell/composables/useLoadingBar';

const { bar } = useLoadingBar();
</script>

<template>
  <div
    ref="bar"
    class="pointer-events-none fixed inset-x-0 top-0 z-9999 h-[3px] origin-left bg-accent opacity-0"
    aria-hidden="true"
  />
</template>
