<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue';

const { t } = useI18n();
const colorMode = useColorMode();

const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;
</script>

<template>
  <div
    class="flex gap-0.5 rounded-full border border-ghost-border bg-surface p-0.5 shadow-input"
    role="group"
    :aria-label="t('common.theme')"
  >
    <button
      v-for="theme in themes"
      :key="theme.value"
      type="button"
      class="flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors"
      :class="
        colorMode.preference === theme.value
          ? 'bg-action text-on-action'
          : 'text-on-ghost-muted hover:text-on-ghost'
      "
      :title="t(`common.${theme.value}`)"
      :aria-label="t(`common.${theme.value}`)"
      :aria-pressed="colorMode.preference === theme.value"
      @click="colorMode.preference = theme.value"
    >
      <component :is="theme.icon" :size="15" aria-hidden="true" />
    </button>
  </div>
</template>
