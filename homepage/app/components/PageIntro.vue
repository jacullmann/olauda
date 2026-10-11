<script setup lang="ts">
defineProps<{
  title: string;
  lede?: string;
}>();
</script>

<template>
  <header class="page page-grid gap-y-6 pt-[clamp(2.5rem,1rem+6vw,7rem)]">
    <h1 class="col-span-12 max-w-[14ch] text-display lg:col-span-8">{{ title }}</h1>
    <p v-if="lede" class="col-span-12 max-w-prose text-lede text-on-ghost-muted lg:col-span-6">
      {{ lede }}
    </p>
  </header>
</template>
