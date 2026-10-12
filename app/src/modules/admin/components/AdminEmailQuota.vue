<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import type { EmailQuota } from '@/modules/admin/types';

const I18N_BASE = 'admin.overview.emails.quota';
/** From this share of the quota on, the bar warns that it runs out. */
const WARNING_SHARE = 0.8;

const props = defineProps<{
  quota: EmailQuota;
}>();

const { t, n } = useI18n();
const { fmtDate } = useAdminFormat();

const share = computed(() => {
  const { used, limit } = props.quota;
  return limit ? Math.min(used / limit, 1) : null;
});
</script>

<template>
  <div>
    <div class="text-base font-medium text-on-ghost-muted">
      {{ t(`${I18N_BASE}.title`) }}
    </div>
    <div class="flex items-baseline gap-1.5 mt-1 tabular-nums">
      <span class="text-3xl font-bold leading-none">{{ n(quota.used) }}</span>
      <span class="text-base text-on-ghost-muted">
        {{
          quota.limit === null
            ? t(`${I18N_BASE}.unlimited`)
            : t(`${I18N_BASE}.of_limit`, { limit: n(quota.limit) })
        }}
      </span>
    </div>

    <div
      v-if="share !== null"
      class="h-1.5 mt-4 rounded-full bg-ghost-border overflow-hidden"
      role="progressbar"
      :aria-label="t(`${I18N_BASE}.title`)"
      :aria-valuenow="quota.used"
      aria-valuemin="0"
      :aria-valuemax="quota.limit ?? undefined"
    >
      <div
        class="h-full rounded-full"
        :class="share >= WARNING_SHARE ? 'bg-warn' : 'bg-accent'"
        :style="{ width: `${share * 100}%` }"
      />
    </div>
    <div class="mt-1.5 text-sm text-on-ghost-muted">
      {{ t(`${I18N_BASE}.resets`, { date: fmtDate(quota.resetsAt) }) }}
    </div>
  </div>
</template>
