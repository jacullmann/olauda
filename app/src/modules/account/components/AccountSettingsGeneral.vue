<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { isSupportedLocale } from '@/i18n';
import { usePersonalization } from '@/modules/account/composables/usePersonalization';
import type { UnitOption } from '@/common/components/BaseSelect.vue';

const { t } = useI18n();
const { user } = storeToRefs(useUserStore());
const { setPersonalization } = usePersonalization();
const { currentLanguage, setLanguage } = usePreferences();

function changeLanguage(language: string) {
  if (isSupportedLocale(language)) setLanguage(language);
}

const personalizationOptions = computed<UnitOption[]>(() => [
  { value: 'yes', label: t('auth.settings.personalization_options.mine') },
  { value: 'no', label: t('auth.settings.personalization_options.all') },
]);

const personalizationValue = computed(() =>
  (user.value?.personalized ?? true) ? 'yes' : 'no',
);

const localeOptions: UnitOption[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

function updatePersonalization(value: string) {
  const personalized = value === 'yes';
  if (personalized === user.value?.personalized) return;
  void setPersonalization(personalized);
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.general.content.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          select
          :separator="false"
          :model-value="personalizationValue"
          :options="personalizationOptions"
          :title="t('auth.settings.personalization')"
          @update:model-value="updatePersonalization"
        >
          <template #label>
            {{ t('auth.settings.personalization') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.general.personalization.description') }}
          </template>
        </BaseList>
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.general.language.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          select
          :separator="false"
          :model-value="currentLanguage"
          :options="localeOptions"
          :title="t('common.language')"
          @update:model-value="changeLanguage"
        >
          <template #label>
            {{ t('common.language') }}
          </template>
        </BaseList>
      </div>
    </section>
  </div>
</template>
