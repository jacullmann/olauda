<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { EmailActivity } from '@/modules/admin/types';
import AdminDailyBarChart from './AdminDailyBarChart.vue';
import AdminPieChart, { type PieSlice } from './AdminPieChart.vue';

const I18N_BASE = 'admin.overview.emails';

const props = defineProps<{
  activity: EmailActivity;
}>();

const { t, n } = useI18n();

const sentPerDay = computed(() =>
  props.activity.days.map(({ day, sent }) => ({ day, value: sent })),
);

const outcomes = computed<PieSlice[]>(() => {
  const { delivered, bounced, failed } = props.activity;
  return [
    { key: 'delivered', value: delivered, color: 'text-success' },
    { key: 'bounced', value: bounced, color: 'text-warn' },
    { key: 'failed', value: failed, color: 'text-danger' },
  ].map((outcome) => ({
    ...outcome,
    label: t(`${I18N_BASE}.outcomes.${outcome.key}`),
  }));
});

const outcomeCount = computed(() =>
  outcomes.value.reduce((sum, outcome) => sum + outcome.value, 0),
);
</script>

<!-- Two cards side by side in the daily charts' grid. -->
<template>
  <AdminDailyBarChart :title="t(`${I18N_BASE}.sent`)" :points="sentPerDay" />
  <AdminPieChart
    :title="t(`${I18N_BASE}.outcomes.title`)"
    :summary="
      t(
        `${I18N_BASE}.outcomes.summary`,
        { count: n(outcomeCount) },
        outcomeCount,
      )
    "
    :slices="outcomes"
  />
</template>
