<script setup lang="ts">
withDefaults(
  defineProps<{
    on?: 'ghost' | 'action';
  }>(),
  {
    on: 'ghost',
  },
);
</script>

<template>
  <kbd :class="on">
    <slot></slot>
  </kbd>
</template>

<style scoped>
kbd {
  display: inline-flex;
  align-items: center;
  font-family: monospace;
  font-size: 0.75rem;
  line-height: 1rem;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
}

kbd.ghost {
  background-color: var(--color-ghost-hover);
  color: var(--color-on-ghost-muted);
}

kbd.action {
  background-color: var(--color-action-hover);
  color: var(--color-on-action-muted);
}
</style>
