<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, type RouteLocationRaw } from 'vue-router';
import { RotateCw } from '@lucide/vue';
import {
  useAdminUsers,
  USER_STATUS_FILTERS,
} from '@/modules/admin/composables/useAdminUsers';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import { useWindowVirtualList } from '@/modules/admin/composables/useWindowVirtualList';
import { fixedTableLayout } from '@/modules/admin/utils/fixedTable';
import AdminListToolbar from '@/modules/admin/components/AdminListToolbar.vue';
import AdminSortHeader from '@/modules/admin/components/AdminSortHeader.vue';
import type { AdminUser, UserStatusFilter } from '@/modules/admin/types';

/** A row's height until it is measured, in px. */
const ROW_HEIGHT = 48;
/** The columns' widths in rem, left to right. */
const TABLE = fixedTableLayout([18, 12, 8, 9, 11]);
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
} = useAdminUsers();
const { fmtDate } = useAdminFormat();
const { t, n } = useI18n();
const router = useRouter();

const statusOptions = computed(() =>
  USER_STATUS_FILTERS.map((status) => ({
    value: status,
    label: t(`admin.users.filters.${status}`),
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
  rows.value.map((row) => ({ row, user: itemAt(row.index) })),
);

const userRoute = (user: AdminUser): RouteLocationRaw => ({
  name: 'admin-user',
  params: { userId: user.id },
});

/**
 * The whole row opens the user. The email inside is a real link, so the row
 * can also be reached by keyboard and opened in a new tab; clicks on it are
 * left to the link.
 */
function openUser(user: AdminUser, event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('a')) return;
  // Selecting an address to copy it is no request to open the user.
  if (window.getSelection()?.toString()) return;
  void router.push(userRoute(user));
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <AdminListToolbar
      id="admin-user-search"
      v-model:search="searchInput"
      :placeholder="t('admin.users.search_placeholder')"
    >
      <div class="sm:w-48">
        <BaseSelect
          :model-value="params.status"
          :options="statusOptions"
          :title="t('admin.users.table.status')"
          @update:model-value="
            (status) => setParams({ status: status as UserStatusFilter })
          "
        />
      </div>
    </AdminListToolbar>

    <div class="flex items-center justify-between gap-3">
      <span class="text-sm text-on-ghost-muted tabular-nums" aria-live="polite">
        <template v-if="state === 'ready'">
          {{ t('admin.users.count', { count: n(total) }, total) }}
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
      {{ t('admin.users.errors.load') }}
    </BaseLoadError>
    <div v-else-if="!total" class="text-center text-on-ghost-muted p-10">
      {{ t('admin.users.empty') }}
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
              :label="t('admin.users.table.email')"
              field="email"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
            <th>{{ t('admin.users.table.username') }}</th>
            <th>{{ t('admin.users.table.status') }}</th>
            <AdminSortHeader
              :label="t('admin.users.table.registered')"
              field="createdAt"
              :sort="params.sort"
              :order="params.order"
              @sort="toggleSort"
            />
            <AdminSortHeader
              :label="t('admin.users.table.last_login')"
              field="lastLoginAt"
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
          <template v-for="{ row, user } in visibleRows" :key="row.index">
            <tr
              v-if="user"
              :ref="measureRow"
              :data-index="row.index"
              :aria-rowindex="row.index + 2"
              class="group cursor-pointer"
              :class="{ 'row-banned': user.isBanned }"
              @click="openUser(user, $event)"
            >
              <td class="truncate" :title="user.email">
                <RouterLink
                  :to="userRoute(user)"
                  class="group-hover:underline"
                  >{{ user.email }}</RouterLink
                >
              </td>
              <td class="truncate">{{ user.username }}</td>
              <td class="whitespace-nowrap">
                <span v-if="user.isSuperadmin" class="badge text-indigo-500">{{
                  t('admin.users.status.admin')
                }}</span>
                <span v-else-if="user.isBanned" class="badge text-danger">{{
                  t('admin.users.status.banned')
                }}</span>
                <span v-else class="badge text-success">{{
                  t('admin.users.status.active')
                }}</span>
              </td>
              <td class="cell-date">{{ fmtDate(user.createdAt) }}</td>
              <td class="cell-date">
                {{ user.lastLoginAt ? fmtDate(user.lastLoginAt) : '—' }}
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

.cell-date {
  font-size: var(--text-sm);
  color: var(--color-on-ghost-muted);
  white-space: nowrap;
}

.badge {
  font-size: var(--text-xs);
  font-weight: 600;
  margin-right: 12px;
}
</style>
