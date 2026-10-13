<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCw } from '@lucide/vue';
import { useEventLog } from '@/modules/admin/composables/useEventLog';
import { useLogFormat } from '@/modules/admin/composables/useLogFormat';
import { useWindowVirtualList } from '@/common/composables/useWindowVirtualList';
import { eventLogRows } from '@/modules/admin/utils/eventLog';
import AdminEventLogEntry, {
  type EventLogPivot,
} from './AdminEventLogEntry.vue';
import AdminEventLogFilters from './AdminEventLogFilters.vue';

const I18N_BASE = 'admin.log';
/** How close to the last loaded row the next page is requested. */
const LOAD_AHEAD_ROWS = 15;
/** Heights rows are laid out with until they are measured, in px. */
const ESTIMATED_HEIGHT = { day: 40, entry: 96, more: 64 } as const;
const MORE_ROW_KEY = 'more';

const { t, n } = useI18n();
const { dayLabel } = useLogFormat();
const {
  params,
  setFilters,
  searchInput,
  hasFilters,
  clearFilters,
  entries,
  total,
  hasMore,
  state,
  loadingMore,
  loadMoreFailed,
  loadMore,
  reload,
} = useEventLog();

const rows = computed(() => eventLogRows(entries.value));
const hasMoreRow = computed(() => hasMore.value || loadMoreFailed.value);

const listEl = useTemplateRef<HTMLElement>('list');
const {
  rows: virtualRows,
  offsetTop,
  totalSize,
  measureRow,
} = useWindowVirtualList({
  container: listEl,
  count: () => rows.value.length + (hasMoreRow.value ? 1 : 0),
  estimateSize: (index) => ESTIMATED_HEIGHT[rows.value[index]?.kind ?? 'more'],
  getItemKey: computed(() => {
    const current = rows.value;
    return (index: number) => current[index]?.key ?? MORE_ROW_KEY;
  }),
  onRangeChange: (_, endIndex) => {
    if (endIndex >= rows.value.length - LOAD_AHEAD_ROWS) void loadMore();
  },
});

const visibleRows = computed(() =>
  virtualRows.value.map((virtualRow) => {
    const row = rows.value[virtualRow.index] ?? null;
    return { virtualRow, row, key: row?.key ?? MORE_ROW_KEY };
  }),
);

const groupName = computed(
  () =>
    entries.value.find((entry) => entry.groupId === params.value.groupId)
      ?.groupName,
);

/** The filtered account's address, from the first entry that names it. */
const userEmail = computed(() => {
  const { userId } = params.value;
  if (!userId) return undefined;
  for (const entry of entries.value) {
    if (entry.userId === userId && entry.userEmail) return entry.userEmail;
    if (entry.actorId === userId && entry.actorEmail) return entry.actorEmail;
  }
  return undefined;
});

/** An entry's type, address or group narrows the log down to it. */
function onPivot(key: EventLogPivot, value: string) {
  void setFilters({ [key]: value });
}

// Changed filters show their results from the start, filters included.
const rootEl = useTemplateRef<HTMLElement>('root');
watch(params, () => {
  const el = rootEl.value;
  if (el && el.getBoundingClientRect().top < 0) {
    el.scrollIntoView({ block: 'start' });
  }
});
</script>

<template>
  <div ref="root" class="flex flex-col gap-3 scroll-mt-(--header-height)">
    <AdminEventLogFilters
      v-model:search="searchInput"
      :filters="params"
      :has-filters="hasFilters"
      :group-name="groupName"
      :user-email="userEmail"
      @change="setFilters"
      @clear="clearFilters"
    />

    <div class="flex items-center justify-between gap-3">
      <span class="text-sm text-on-ghost-muted tabular-nums" aria-live="polite">
        <template v-if="total !== null">
          {{ t(`${I18N_BASE}.entries`, { count: n(total) }, total) }}
        </template>
      </span>
      <BaseButton variant="ghost" size="sm" :icon="RotateCw" @click="reload">
        {{ t('common.buttons.refresh') }}
      </BaseButton>
    </div>

    <div
      v-if="state === 'loading' && !entries.length"
      class="flex justify-center p-10"
    >
      <BaseSpinner on="ghost" size="24px" />
    </div>
    <BaseLoadError v-else-if="state === 'failed'" @retry="reload">
      {{ t(`${I18N_BASE}.errors.load`) }}
    </BaseLoadError>
    <p
      v-else-if="!entries.length"
      class="text-center text-on-ghost-muted p-10 m-0"
    >
      {{ t(`${I18N_BASE}.${hasFilters ? 'empty_filtered' : 'empty'}`) }}
    </p>
    <div
      v-else
      ref="list"
      class="relative"
      :class="{ 'opacity-60 pointer-events-none': state === 'loading' }"
      :style="{ height: `${totalSize}px` }"
      :aria-busy="state === 'loading'"
    >
      <ol
        class="absolute inset-x-0 top-0 m-0 p-0 list-none"
        :style="{ transform: `translateY(${offsetTop}px)` }"
      >
        <li
          v-for="{ virtualRow, row, key } in visibleRows"
          :key="key"
          :ref="measureRow"
          :data-index="virtualRow.index"
        >
          <h4
            v-if="row?.kind === 'day'"
            class="pt-4 pb-1.5 text-sm font-semibold text-on-ghost-muted"
            :class="{ 'pt-0!': virtualRow.index === 0 }"
          >
            <time :datetime="row.dateKey">
              {{ dayLabel(row.date) }}
            </time>
          </h4>
          <div
            v-else-if="row?.kind === 'entry'"
            class="px-4 py-3 bg-surface border-x border-t border-ghost-border"
            :class="{
              'rounded-t-xl': row.isFirstOfDay,
              'rounded-b-xl border-b': row.isLastOfDay,
            }"
          >
            <AdminEventLogEntry
              :entry="row.entry"
              :scoped-user-id="params.userId || undefined"
              @pivot="onPivot"
            />
          </div>
          <div v-else class="flex justify-center py-4">
            <BaseButton
              v-if="loadMoreFailed && !loadingMore"
              variant="ghost"
              @click="loadMore"
            >
              {{ t(`${I18N_BASE}.load_more`) }}
            </BaseButton>
            <BaseSpinner v-else on="ghost" size="20px" />
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>
