<script setup lang="ts">
defineProps<{
  title: string;
  /** What the chart currently says in brief: a summary, or the hovered value. */
  readout: string;
}>();
</script>

<template>
  <figure
    class="m-0 rounded-xl border border-ghost-border bg-surface shadow-input px-4 py-3"
  >
    <figcaption
      class="flex flex-wrap items-baseline justify-between gap-x-2 mb-3"
    >
      <span class="font-semibold">{{ title }}</span>
      <span class="text-sm text-on-ghost-muted tabular-nums" aria-live="polite">
        {{ readout }}
      </span>
    </figcaption>

    <slot />
  </figure>
</template>
