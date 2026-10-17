<script setup lang="ts">
import { computed } from 'vue';
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { isThemeMode } from '@/common/composables/useTheme';
import { Sun, Moon, SunMoon } from '@lucide/vue';
import BaseMenuSelect, {
  type MenuOption,
} from '@/common/components/BaseMenuSelect.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const themeOptions = computed<MenuOption[]>(() => [
  { value: 'system', label: t('common.theme.system'), icon: SunMoon },
  { value: 'dark', label: t('common.theme.dark'), icon: Moon },
  { value: 'light', label: t('common.theme.light'), icon: Sun },
]);

const { currentTheme, setTheme } = usePreferences();

function updateTheme(mode: string) {
  if (isThemeMode(mode)) setTheme(mode);
}
</script>

<template>
  <BaseMenuSelect
    :model-value="currentTheme"
    :options="themeOptions"
    :prefix="t('common.theme.theme')"
    @update:model-value="updateTheme"
  />
</template>
