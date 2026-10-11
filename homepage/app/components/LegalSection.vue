<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <section
    class="grid gap-x-gutter gap-y-3 border-b border-ghost-border py-8 text-on-ghost-muted md:grid-cols-10"
  >
    <h2 class="font-sans text-base font-semibold text-on-ghost md:col-span-3">{{ title }}</h2>
    <div class="max-w-prose md:col-span-7">
      <slot />
    </div>
  </section>
</template>
