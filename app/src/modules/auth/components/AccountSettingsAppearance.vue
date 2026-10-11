<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePreferences } from '@/common/composables/usePreferences';
import type { ThemeMode } from '@/common/composables/useTheme';
import ThemePreview from '@/modules/auth/components/ThemePreview.vue';
import { haptic } from '@/utils/haptics';

const { t } = useI18n();
const { currentTheme, setPreference } = usePreferences();

const headingId = useId();
const radioName = useId();

const themeOptions = computed<{ value: ThemeMode; label: string }[]>(() => [
  { value: 'light', label: t('common.theme.light') },
  { value: 'dark', label: t('common.theme.dark') },
  { value: 'system', label: t('common.theme.system') },
]);

function selectTheme(theme: ThemeMode) {
  setPreference('theme', theme);
  haptic();
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-4">
      <h3 :id="headingId">{{ t('common.theme.theme') }}</h3>

      <div
        role="radiogroup"
        :aria-labelledby="headingId"
        class="flex justify-around"
      >
        <label
          v-for="option in themeOptions"
          :key="option.value"
          class="group flex flex-1 flex-col items-center gap-2.5 mx-1.5 max-w-30 md:max-w-42 cursor-pointer"
        >
          <input
            type="radio"
            class="peer sr-only"
            :name="radioName"
            :value="option.value"
            :checked="option.value === currentTheme"
            @change="selectTheme(option.value)"
          />
          <ThemePreview
            :theme="option.value"
            class="w-full outline-2 outline-offset-2 outline-transparent transition-[outline-color,box-shadow] duration-(--duration-focus) ease-(--ease-focus) group-hover:outline-ghost-border peer-checked:outline-accent peer-focus-visible:shadow-focus-ring"
          />
          <span
            class="text-sm font-medium text-on-ghost-muted transition-colors duration-(--duration-focus) ease-(--ease-focus) peer-checked:text-on-ghost"
          >
            {{ option.label }}
          </span>
        </label>
      </div>
    </section>
  </div>
</template>
