<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from '@lucide/vue';
import type { EventLogFilters } from '../composables/useEventLog';
import { useLogFormat } from '../composables/useLogFormat';
import { useSuperAdminFormat } from '../composables/useSuperAdminFormat';
import {
  EVENT_CATEGORIES,
  EVENT_SOURCES,
  localDayStart,
} from '../utils/eventLog';
import AdminListToolbar from './AdminListToolbar.vue';

const I18N_BASE = 'admin.log.filters';
/** The select's value for a filter that is not set. */
const ANY = '';

const props = defineProps<{
  filters: EventLogFilters;
  hasFilters: boolean;
  /** The name of the filtered group, once an entry has shown it. */
  groupName?: string | null;
}>();

const search = defineModel<string>('search', { required: true });

const emit = defineEmits<{
  (e: 'change', patch: Partial<EventLogFilters>): void;
  (e: 'clear'): void;
}>();

const { t } = useI18n();
const { anyEventLabel, categoryLabel } = useLogFormat();
const { fmtDate } = useSuperAdminFormat();
const id = useId();

const sourceTabs = computed(() => [
  { id: ANY, label: t('admin.log.sources.all') },
  ...EVENT_SOURCES.map((source) => ({
    id: source,
    label: t(`admin.log.sources.${source}`),
  })),
]);

const categoryOptions = computed(() => {
  const { source, category } = props.filters;
  const shown: string[] = EVENT_CATEGORIES.filter(
    (c) => !source || c.sources.some((s) => s === source),
  ).map((c) => c.id);
  // A category from a link stays visible as selected, even one this build
  // does not know or the chosen log does not record.
  if (category && !shown.includes(category)) shown.push(category);

  return [
    { value: ANY, label: t(`${I18N_BASE}.all_categories`) },
    ...shown.map((c) => ({ value: c, label: categoryLabel(c) })),
  ];
});

const outcomeOptions = computed(() => [
  { value: ANY, label: t(`${I18N_BASE}.all_outcomes`) },
  { value: 'success', label: t('admin.log.outcomes.success') },
  { value: 'failure', label: t('admin.log.outcomes.failure') },
]);

const isNewestFirst = computed(() => props.filters.order === 'desc');

interface FilterChip {
  key: keyof EventLogFilters;
  label: string;
}

/** Filters set from an entry or a date, shown so they can be seen and removed. */
const chips = computed(() => {
  const { type, ip, groupId, from, to } = props.filters;
  const day = (key: string) => fmtDate(localDayStart(key));
  const result: FilterChip[] = [];
  if (type) result.push({ key: 'type', label: anyEventLabel(type) });
  if (ip)
    result.push({ key: 'ip', label: t(`${I18N_BASE}.ip`, { value: ip }) });
  if (groupId) {
    const value = props.groupName ?? groupId;
    result.push({ key: 'groupId', label: t(`${I18N_BASE}.group`, { value }) });
  }
  if (from) {
    result.push({
      key: 'from',
      label: t(`${I18N_BASE}.from_day`, { date: day(from) }),
    });
  }
  if (to) {
    result.push({
      key: 'to',
      label: t(`${I18N_BASE}.to_day`, { date: day(to) }),
    });
  }
  return result;
});

function set(key: keyof EventLogFilters, value: string) {
  emit('change', { [key]: value } as Partial<EventLogFilters>);
}

// The activity log records no outcome, and the select for it hides.
function setSource(source: string) {
  emit('change', {
    source: source as EventLogFilters['source'],
    ...(source === 'activity' && { outcome: ANY }),
  });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <AdminListToolbar
      :id="`${id}-search`"
      v-model:search="search"
      :placeholder="t(`${I18N_BASE}.search_placeholder`)"
    >
      <BaseTabs
        :items="sourceTabs"
        :active-id="filters.source"
        @change="setSource"
      />
    </AdminListToolbar>

    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
      <div class="sm:w-52">
        <BaseSelect
          :model-value="filters.category"
          :options="categoryOptions"
          :title="t(`${I18N_BASE}.category`)"
          @update:model-value="(category) => set('category', category)"
        />
      </div>
      <div v-if="filters.source !== 'activity'" class="sm:w-44">
        <BaseSelect
          :model-value="filters.outcome"
          :options="outcomeOptions"
          :title="t(`${I18N_BASE}.outcome`)"
          @update:model-value="(outcome) => set('outcome', outcome)"
        />
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 sm:w-40">
          <BaseDatePicker
            :id="`${id}-from`"
            :model-value="filters.from || null"
            :max="filters.to || undefined"
            :placeholder="t(`${I18N_BASE}.from`)"
            :title="t(`${I18N_BASE}.from`)"
            :aria-label="t(`${I18N_BASE}.from`)"
            @update:model-value="(day) => set('from', day ?? ANY)"
          />
        </div>
        <span class="text-on-ghost-muted" aria-hidden="true">–</span>
        <div class="flex-1 sm:w-40">
          <BaseDatePicker
            :id="`${id}-to`"
            :model-value="filters.to || null"
            :min="filters.from || undefined"
            :placeholder="t(`${I18N_BASE}.to`)"
            :title="t(`${I18N_BASE}.to`)"
            :aria-label="t(`${I18N_BASE}.to`)"
            @update:model-value="(day) => set('to', day ?? ANY)"
          />
        </div>
      </div>
      <BaseButton
        variant="ghost"
        :icon="isNewestFirst ? ArrowDownWideNarrow : ArrowUpNarrowWide"
        :aria-pressed="!isNewestFirst"
        @click="set('order', isNewestFirst ? 'asc' : 'desc')"
      >
        {{
          t(`${I18N_BASE}.${isNewestFirst ? 'newest_first' : 'oldest_first'}`)
        }}
      </BaseButton>
    </div>

    <div
      v-if="chips.length || hasFilters"
      class="flex flex-wrap items-center gap-2"
    >
      <BaseButton
        v-for="chip in chips"
        :key="chip.key"
        chip
        surface
        :aria-label="t(`${I18N_BASE}.remove`, { filter: chip.label })"
        @click="set(chip.key, ANY)"
      >
        {{ chip.label }}
      </BaseButton>
      <BaseButton v-if="hasFilters" variant="ghost" @click="emit('clear')">
        {{ t(`${I18N_BASE}.reset`) }}
      </BaseButton>
    </div>
  </div>
</template>
