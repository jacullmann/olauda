<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <PageIntro :title="title" :lede="description" />
  <div class="page page-grid pt-[clamp(3rem,2rem+4vw,6rem)] pb-section">
    <div class="col-span-12 border-t border-on-ghost lg:col-span-10">
      <slot />
    </div>
  </div>
</template>
