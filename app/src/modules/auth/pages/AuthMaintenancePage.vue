<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CloudOff } from '@lucide/vue';

const router = useRouter();
const { t } = useI18n();

function navigateToLogin() {
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="w-full max-w-105" role="status" aria-live="polite">
    <BaseEmptyState
      :icon="CloudOff"
      full-page
      :primary-action="navigateToLogin"
    >
      {{ t('auth.access.shutdown.title') }}
      <template #message>{{ t('auth.access.shutdown.message') }}</template>
      <template #primary-action-label>{{ t('auth.access.to_login') }}</template>
    </BaseEmptyState>
  </div>
</template>
