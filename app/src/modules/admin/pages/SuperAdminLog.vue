<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import EventLogView from '../components/EventLogView.vue';

const { t } = useI18n();
</script>

<template>
  <PageHeader>{{ t('admin.log.title') }}</PageHeader>
  <p class="text-sm text-on-ghost-muted -mt-2 mb-4">
    {{ t('admin.log.hint') }}
  </p>
  <EventLogView />
</template>
