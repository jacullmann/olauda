<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUp } from '@lucide/vue';
import DailyBarChart, {
  type DailySummary,
} from '../components/DailyBarChart.vue';
import AccessControlsSection from '../components/AccessControlsSection.vue';
import CleanupJobsSection from '../components/CleanupJobsSection.vue';
import ServerMetricsSection from '../components/ServerMetricsSection.vue';
import WeeklyRhythmHeatmap from '../components/WeeklyRhythmHeatmap.vue';
import { useSuperAdminStats } from '../composables/useSuperAdminStats';
import type { DailyMetric } from '../types';

interface DailyChart {
  metric: DailyMetric;
  i18nKey: string;
  summary?: DailySummary;
}

const {
  stats,
  dailyActivity,
  weeklyRhythm,
  loadingStats,
  loadDailyActivity,
  loadWeeklyRhythm,
} = useSuperAdminStats();
const { t } = useI18n();

const headlineStats = computed(() =>
  stats.value
    ? [
        {
          key: 'users',
          value: stats.value.userCount,
          increase: stats.value.newUsersThisWeek,
        },
        {
          key: 'tasks',
          value: stats.value.itemCount,
          increase: stats.value.newItemsThisWeek,
        },
      ]
    : [],
);

// Paired for the two-column grid: usage, growth, then content and security.
const dailyCharts: readonly DailyChart[] = [
  { metric: 'appOpens', i18nKey: 'app_opens' },
  { metric: 'activeUsers', i18nKey: 'active_users', summary: 'average' },
  { metric: 'newUsers', i18nKey: 'new_users' },
  { metric: 'newGroups', i18nKey: 'new_groups' },
  { metric: 'newItems', i18nKey: 'new_tasks' },
  { metric: 'failedLogins', i18nKey: 'failed_logins' },
];

const charts = computed(() =>
  dailyCharts.map((chart) => ({
    ...chart,
    points: dailyActivity.value.map((d) => ({
      day: d.day,
      value: d[chart.metric],
    })),
  })),
);

// The stats themselves are loaded once by the dashboard shell.
onMounted(() => Promise.all([loadDailyActivity(), loadWeeklyRhythm()]));
</script>

<template>
  <PageHeader>{{ t('admin.overview.title') }}</PageHeader>

  <div v-if="loadingStats && !stats" class="flex justify-center p-10">
    <BaseSpinner on="ghost" size="24px" />
  </div>
  <div v-else-if="stats" class="flex flex-col gap-7">
    <div class="grid max-md:grid-rows-2 md:grid-cols-2 px-4 gap-8">
      <div v-for="s in headlineStats" :key="s.key">
        <div class="text-base font-medium text-on-ghost-muted">
          {{ t(`admin.overview.stats.${s.key}`) }}
        </div>
        <div class="flex items-start gap-2 mt-1">
          <div class="text-3xl font-bold leading-none tabular-nums">
            {{ s.value }}
          </div>
          <div class="flex items-center text-base/5">
            <ArrowUp
              :class="s.increase > 0 ? 'text-success' : 'text-on-ghost-muted'"
              :size="20"
            />
            <span class="font-bold ml-0.5">{{ s.increase }}</span>
            <span class="text-on-ghost-muted ml-1">{{
              t('admin.overview.stats.last_week')
            }}</span>
          </div>
        </div>

        <div v-if="s.key === 'users'" class="flex mt-4">
          <div class="flex flex-1 flex-col">
            <span class="text-on-ghost-muted text-sm leading-none">{{
              t('admin.overview.stats.pending_sign_ups')
            }}</span>

            <span class="font-bold tabular-nums">{{
              stats.pendingSignUps
            }}</span>
          </div>
          <div class="border-r border-ghost-border mx-4"></div>
          <div class="flex flex-1 flex-col">
            <span class="text-on-ghost-muted text-sm leading-none">{{
              t('admin.overview.stats.banned')
            }}</span>
            <span class="font-bold tabular-nums">{{ stats.bannedCount }}</span>
          </div>
          <div class="border-r border-ghost-border mx-4"></div>
          <div class="flex flex-1 flex-col">
            <span class="text-on-ghost-muted text-sm leading-none">{{
              t('admin.overview.stats.active_week')
            }}</span>
            <span class="font-bold tabular-nums">{{
              stats.activeUsersThisWeek
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <section class="flex flex-col gap-3">
      <h3>{{ t('admin.overview.chart.title') }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DailyBarChart
          v-for="chart in charts"
          :key="chart.metric"
          :title="t(`admin.overview.chart.${chart.i18nKey}`)"
          :points="chart.points"
          :summary="chart.summary"
        />
      </div>
    </section>

    <section v-if="weeklyRhythm" class="flex flex-col gap-3">
      <div>
        <h3>{{ t('admin.overview.weekly_rhythm.title') }}</h3>
        <p class="text-sm text-on-ghost-muted">
          {{
            t('admin.overview.weekly_rhythm.hint', {
              weeks: weeklyRhythm.weeks,
            })
          }}
        </p>
      </div>
      <WeeklyRhythmHeatmap
        :title="t('admin.overview.weekly_rhythm.chart')"
        :rhythm="weeklyRhythm"
      />
    </section>

    <CleanupJobsSection />

    <ServerMetricsSection />
  </div>

  <!-- Outside the stats: the switches must work even when they fail to load. -->
  <AccessControlsSection class="mt-7" />
</template>
