<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';

const { t } = useI18n();
const { settings, updateSetting } = usePageSettings('dashboard');
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.dashboard.header.title') }}</h3>

      <div class="flex flex-col max-md:-mx-6">
        <BaseList
          toggle
          :separator="false"
          :checked="settings.tagline"
          @update:checked="updateSetting('tagline', $event)"
        >
          <template #label>
            {{ t('auth.account_settings.dashboard.tagline.title') }}
          </template>
          <template #desc>
            {{ t('auth.account_settings.dashboard.tagline.description') }}
          </template>
        </BaseList>
      </div>
    </section>
  </div>
</template>
