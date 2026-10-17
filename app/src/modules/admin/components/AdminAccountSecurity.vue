<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccountSecurity } from '@/modules/admin/composables/useAccountSecurity';
import AdminPieChart, {
  type PieColor,
  type PieSlice,
} from './AdminPieChart.vue';

const I18N_BASE = 'admin.overview.accounts';

const { t, n } = useI18n();
const { security } = useAccountSecurity();

const charts = computed(() => {
  const s = security.value;
  if (!s) return [];

  const { secondFactor: factor, google } = s;
  const total =
    factor.neither + factor.mfaOnly + factor.passkeyOnly + factor.both;
  const summary = t(`${I18N_BASE}.summary`, { count: n(total) }, total);
  const slice = (
    group: string,
    key: string,
    value: number,
    color: PieColor,
  ): PieSlice => ({
    key,
    label: t(`${I18N_BASE}.${group}.${key}`),
    value,
    color,
  });

  return [
    {
      key: 'second_factor',
      summary,
      slices: [
        slice('second_factor', 'neither', factor.neither, 'gray'),
        slice('second_factor', 'mfa_only', factor.mfaOnly, 'purple'),
        slice('second_factor', 'passkey_only', factor.passkeyOnly, 'yellow'),
        slice('second_factor', 'both', factor.both, 'blue'),
      ],
    },
    {
      key: 'google',
      summary,
      slices: [
        slice('google', 'not_linked', google.notLinked, 'gray'),
        slice('google', 'linked', google.linked, 'blue'),
        slice('google', 'google_only', google.googleOnly, 'purple'),
      ],
    },
  ];
});
</script>

<template>
  <section v-if="charts.length" class="flex flex-col gap-3">
    <h3>{{ t(`${I18N_BASE}.title`) }}</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <AdminPieChart
        v-for="chart in charts"
        :key="chart.key"
        :title="t(`${I18N_BASE}.${chart.key}.title`)"
        :summary="chart.summary"
        :slices="chart.slices"
      />
    </div>
  </section>
</template>
