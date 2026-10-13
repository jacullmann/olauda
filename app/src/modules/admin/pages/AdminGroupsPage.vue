<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, type RouteLocationRaw } from 'vue-router';
import { RotateCw } from '@lucide/vue';
import {
  useAdminGroups,
  GROUP_TYPE_FILTERS,
} from '@/modules/admin/composables/useAdminGroups';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import { useWindowVirtualList } from '@/common/composables/useWindowVirtualList';
import { fixedTableLayout } from '@/modules/admin/utils/fixedTable';
import AdminListToolbar from '@/modules/admin/components/AdminListToolbar.vue';
import AdminSortHeader from '@/modules/admin/components/AdminSortHeader.vue';
import type { AdminGroup, GroupTypeFilter } from '@/modules/admin/types';

/** A row's height until it is measured, in px. */
const ROW_HEIGHT = 48;
/** The columns' widths in rem, left to right. */
const TABLE = fixedTableLayout([18, 8, 16, 8, 8, 8]);
const COLUMN_COUNT = TABLE.columns.length;

const {
  params,
  setParams,
  toggleSort,
  searchInput,
  total,
  state,
  itemAt,
  ensureRange,
  refresh,
} = useAdminGroups();
const { fmtDate } = useAdminFormat();
const { t, n } = useI18n();
const router = useRouter();

const typeOptions = computed(() =>
  GROUP_TYPE_FILTERS.map((type) => ({
    value: type,
    label: t(`admin.groups.filters.${type}`),
  })),
);

const bodyEl = useTemplateRef<HTMLElement>('body');
const { rows, offsetTop, offsetBottom, measureRow } = useWindowVirtualList({
  container: bodyEl,
  count: total,
  estimateSize: () => ROW_HEIGHT,
  onRangeChange: ensureRange,
});

const visibleRows = computed(() =>
  rows.value.map((row) => ({ row, group: itemAt(row.index) })),
);

const groupRoute = (group: AdminGroup): RouteLocationRaw => ({
  name: 'admin-group',
  params: { adminGroupId: group.id },
});

/**
 * The whole row opens the group. Its name and owner inside are real links, so
 * the row can also be reached by keyboard and opened in a new tab; clicks on
 * them are left to the links.
 */
function openGroup(group: AdminGroup, event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a')) return;
  // Selecting a name to copy it is no request to open the group.
  if (window.getSelection()?.toString()) return;
  void router.push(groupRoute(group));
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <AdminListToolbar
      id="admin-group-search"
      v-model:search="searchInput"
      :placeholder="t('admin.groups.search_placeholder')"
    >
      <div class="sm:w-48">
        <BaseSelect
          :model-value="params.type"
          :options="typeOptions"
          :title="t('admin.groups.table.type')"
          @update:model-value="
            (type) => setParams({ type: type as GroupTypeFilter })
          "
        />
      </div>
    </AdminListToolbar>

    <div class="flex items-center justify-between gap-3">
      <span class="text-sm text-on-ghost-muted tabular-nums" aria-live="polite">
        <template v-if="state === 'ready'">
          {{ t('admin.groups.count', { count: n(total) }, total) }}
        </template>
      </span>
      <BaseButton variant="ghost" size="sm" :icon="RotateCw" @click="refresh">
        {{ t('common.buttons.refresh') }}
      </BaseButton>
    </div>

    <div v-if="state === 'loading'" class="flex justify-center p-10">
      <BaseSpinner on="ghost" size="24px" />
    </div>
    <BaseLoadError v-else-if="state === 'failed'" @retry="refresh">
      {{ t('admin.groups.errors.load') }}
    </BaseLoadError>
    <div v-else-if="!total" class="text-center text-on-ghost-muted p-10">
      {{ t('admin.groups.empty') }}
    </div>
    <BaseTableWrapper v-else>
      <table :style="TABLE.table" :aria-rowcount="total + 1">
        <colgroup>
          <col
            v-for="(column, index) in TABLE.columns"
            :key="index"
            :style="column"
          />
        </colgroup>
        <thead>
          <tr aria-rowindex="1">
            <AdminSortHeader
              :label="t('admin.groups.table.name')"
              field="name"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
            <th>{{ t('admin.groups.table.type') }}</th>
            <th>{{ t('admin.groups.table.owner') }}</th>
            <AdminSortHeader
              :label="t('admin.groups.table.members')"
              field="memberCount"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
            <AdminSortHeader
              :label="t('admin.groups.table.tasks')"
              field="itemCount"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
            <AdminSortHeader
              :label="t('admin.groups.table.created')"
              field="createdAt"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
          </tr>
        </thead>
        <tbody ref="body">
          <tr v-if="offsetTop" aria-hidden="true">
            <td
              :colspan="COLUMN_COUNT"
              class="p-0! after:hidden"
              :style="{ height: `${offsetTop}px` }"
            />
          </tr>
          <template v-for="{ row, group: g } in visibleRows" :key="row.index">
            <tr
              v-if="g"
              :ref="measureRow"
              :data-index="row.index"
              :aria-rowindex="row.index + 2"
              class="group cursor-pointer"
              :class="{ 'row-banned': g.bannedAt }"
              @click="openGroup(g, $event)"
            >
              <td>
                <div class="flex items-center gap-2 min-w-0">
                  <BaseAvatar :name="g.name" :picture="g.avatarUrl" :size="6" />
                  <RouterLink
                    :to="groupRoute(g)"
                    class="truncate group-hover:underline"
                    :title="g.name"
                    >{{ g.name }}</RouterLink
                  >
                  <span
                    v-if="g.bannedAt"
                    class="shrink-0 text-xs font-semibold text-danger"
                    >{{ t('admin.groups.status.banned') }}</span
                  >
                </div>
              </td>
              <td class="whitespace-nowrap">
                {{ t(`admin.groups.filters.${g.groupType}`) }}
              </td>
              <td class="truncate" :title="g.ownerEmail">
                <RouterLink
                  :to="{ name: 'admin-user', params: { userId: g.ownerId } }"
                  class="hover:underline"
                  >{{ g.ownerEmail }}</RouterLink
                >
              </td>
              <td class="tabular-nums">{{ g.memberCount }}</td>
              <td class="tabular-nums">{{ g.itemCount }}</td>
              <td class="whitespace-nowrap text-sm text-on-ghost-muted">
                {{ fmtDate(g.createdAt) }}
              </td>
            </tr>
            <tr
              v-else
              :ref="measureRow"
              :data-index="row.index"
              :aria-rowindex="row.index + 2"
              aria-busy="true"
            >
              <td :colspan="COLUMN_COUNT">
                <BaseSkeleton height="6" radius="md" />
              </td>
            </tr>
          </template>
          <tr v-if="offsetBottom" aria-hidden="true">
            <td
              :colspan="COLUMN_COUNT"
              class="p-0! after:hidden"
              :style="{ height: `${offsetBottom}px` }"
            />
          </tr>
        </tbody>
      </table>
    </BaseTableWrapper>
  </div>
</template>

<style scoped>
.row-banned td {
  color: var(--color-on-ghost-muted);
}
</style>
