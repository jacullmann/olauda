<script setup lang="ts">
import { ref } from 'vue';
import { Info } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    tooltip: string;
    iconSize?: number;
  }>(),
  { iconSize: 20 },
);

const isModalOpen = ref(false);

const openModal = () => (isModalOpen.value = true);
const closeModal = () => (isModalOpen.value = false);
</script>

<template>
  <div class="flex items-center" :title="props.tooltip">
    <div
      class="relative flex items-center justify-center cursor-pointer text-on-ghost-muted transition-colors duration-100 hover:text-on-ghost touch-target after:min-w-12 after:min-h-12"
      @click="openModal"
    >
      <Info :size="props.iconSize" />
    </div>
  </div>

  <Teleport to="body">
    <BaseModal :open="isModalOpen" sheet @cancel="closeModal">
      <template #title>
        <template v-if="props.title">{{ props.title }}</template>
      </template>
      <template #content>
        <div class="leading-[1.6] [&_b]:text-inherit! [&_strong]:text-inherit!">
          <slot></slot>
        </div>
      </template>
    </BaseModal>
  </Teleport>
</template>
