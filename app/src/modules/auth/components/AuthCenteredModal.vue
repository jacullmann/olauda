<script setup lang="ts">
import { useEventListener } from '@vueuse/core';

defineProps<{
  title: string;
  closeOnBackdrop?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close');
  }
});

function handleBackdropClick() {
  emit('close');
}
</script>

<template>
  <div
    class="flex items-center justify-center"
    @click.self="closeOnBackdrop !== false && handleBackdropClick()"
  >
    <div
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title"
      class="w-full max-w-105"
    >
      <h2 :id="title" class="mb-2!">
        {{ title }}
      </h2>

      <slot />
    </div>
  </div>
</template>
