<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AdminEventLog from '@/modules/admin/components/AdminEventLog.vue';

const { t } = useI18n();
</script>

<template>
  <BasePageHeader>{{ t('admin.log.title') }}</BasePageHeader>
  <p class="text-sm text-on-ghost-muted -mt-2 mb-4">
    {{ t('admin.log.hint') }}
  </p>
  <AdminEventLog />
</template>
