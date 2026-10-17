<script setup lang="ts">
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { isSupportedLocale } from '@/i18n';
import { Languages } from '@lucide/vue';
import BaseMenuSelect, {
  type MenuOption,
} from '@/common/components/BaseMenuSelect.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const localeOptions: MenuOption[] = [
  { value: 'de', label: 'Deutsch', icon: Languages },
  { value: 'en', label: 'English', icon: Languages },
];

const { currentLanguage, setLanguage } = usePreferences();

function updateLocale(loc: string) {
  if (isSupportedLocale(loc)) setLanguage(loc);
}
</script>

<template>
  <BaseMenuSelect
    :model-value="currentLanguage"
    :options="localeOptions"
    :prefix="t('common.language')"
    @update:model-value="updateLocale"
  />
</template>
