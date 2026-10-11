<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminTimeSeriesChart, {
  type ChartSeries,
} from './AdminTimeSeriesChart.vue';
import {
  METRICS_RANGES,
  isMetricsRange,
  useServerMetrics,
} from '@/modules/admin/composables/useServerMetrics';
import {
  formatByteRate,
  formatPercent,
} from '@/modules/admin/utils/metricFormat';

const I18N_BASE = 'admin.overview.server';

interface MetricChart {
  key: string;
  title: string;
  series: ChartSeries[];
  max?: number;
  format: (value: number) => string;
}

const { t, locale } = useI18n();
const { range, metrics, loading, failed, setRange, load } = useServerMetrics();

const rangeItems = computed(() =>
  METRICS_RANGES.map((id) => ({ id, label: t(`${I18N_BASE}.ranges.${id}`) })),
);

function onRangeChange(id: string) {
  if (isMetricsRange(id)) void setRange(id);
}

const formatRate = (value: number) => formatByteRate(value, locale.value);

const charts = computed<MetricChart[]>(() => {
  const m = metrics.value;
  if (!m) return [];

  return [
    {
      key: 'cpu',
      title: t(`${I18N_BASE}.cpu`),
      series: [{ label: t(`${I18N_BASE}.usage`), points: m.cpu }],
      max: m.cpuCores * 100,
      format: (value) => formatPercent(value, locale.value),
    },
    {
      key: 'network',
      title: t(`${I18N_BASE}.network`),
      series: [
        { label: t(`${I18N_BASE}.received`), points: m.networkIn },
        { label: t(`${I18N_BASE}.sent`), points: m.networkOut },
      ],
      format: formatRate,
    },
  ];
});
</script>

<template>
  <section class="flex flex-col gap-3">
    <h3>{{ t(`${I18N_BASE}.title`) }}</h3>
    <BaseTabs :items="rangeItems" :active-id="range" @change="onRangeChange" />

    <div
      v-if="failed"
      class="flex justify-center rounded-xl border border-ghost-border bg-surface p-6"
    >
      <BaseButton variant="ghost" @click="load">
        {{ t(`${I18N_BASE}.retry`) }}
      </BaseButton>
    </div>
    <div v-else-if="!metrics" class="flex justify-center p-10">
      <BaseSpinner on="ghost" size="24px" />
    </div>
    <div
      v-else
      class="flex flex-col gap-3 transition-opacity"
      :class="{ 'opacity-60': loading }"
      :aria-busy="loading"
    >
      <AdminTimeSeriesChart
        v-for="chart in charts"
        :key="chart.key"
        :title="chart.title"
        :series="chart.series"
        :start="metrics.start"
        :end="metrics.end"
        :max="chart.max"
        :format="chart.format"
      />
    </div>
  </section>
</template>
