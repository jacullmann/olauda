<script setup lang="ts">
import { computed, onMounted, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCleanupJobs } from '@/modules/admin/composables/useCleanupJobs';

const I18N_BASE = 'admin.overview.cleanup_jobs';

const i18n = useI18n();
const { t } = i18n;
const { jobs, loading, failed, loadJobs } = useCleanupJobs();
const titleId = useId();

function optionalText(key: string): string | undefined {
  return i18n.te(key) ? t(key) : undefined;
}

// A job this build has no text for still shows, under its scheduled name.
const rows = computed(() =>
  jobs.value.map(({ job, overdueCount }) => ({
    job,
    overdueCount,
    label: optionalText(`${I18N_BASE}.jobs.${job}.label`) ?? job,
    rule: optionalText(`${I18N_BASE}.jobs.${job}.rule`),
  })),
);

const overdueJobCount = computed(
  () => rows.value.filter((row) => row.overdueCount > 0).length,
);

onMounted(loadJobs);
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="titleId">
    <header class="flex items-baseline justify-between gap-2">
      <h3 :id="titleId">{{ t(`${I18N_BASE}.title`) }}</h3>
      <span
        v-if="!loading && !failed && rows.length"
        class="shrink-0 text-sm font-semibold"
        :class="overdueJobCount ? 'text-warn' : 'text-accent'"
      >
        {{
          overdueJobCount
            ? t(`${I18N_BASE}.jobs_overdue`, { count: overdueJobCount })
            : t(`${I18N_BASE}.all_ok`)
        }}
      </span>
    </header>

    <div
      class="rounded-xl border border-ghost-border bg-surface shadow-input p-4"
    >
      <div v-if="loading" class="flex justify-center p-4">
        <BaseSpinner on="ghost" size="20px" />
      </div>
      <div v-else-if="failed" class="flex justify-center p-4">
        <BaseButton variant="ghost" @click="loadJobs">
          {{ t(`${I18N_BASE}.retry`) }}
        </BaseButton>
      </div>
      <template v-else>
        <!-- A grid rather than CSS columns keeps both halves' rows aligned
             when a rule wraps onto a second line. -->
        <ul class="grid md:grid-cols-2 md:gap-x-8">
          <li
            v-for="row in rows"
            :key="row.job"
            class="flex items-baseline justify-between gap-3 py-1.5 text-sm border-b border-ghost-border last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <span class="min-w-0">
              <span class="font-semibold">{{ row.label }}</span>
              <span v-if="row.rule" class="text-on-ghost-muted">
                · {{ row.rule }}</span
              >
            </span>
            <span
              class="shrink-0 font-semibold tabular-nums"
              :class="row.overdueCount > 0 ? 'text-warn' : 'text-accent'"
            >
              {{
                row.overdueCount > 0
                  ? t(`${I18N_BASE}.overdue`, { count: row.overdueCount })
                  : t(`${I18N_BASE}.ok`)
              }}
            </span>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
