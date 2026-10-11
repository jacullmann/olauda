<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ArrowUpRight, RotateCw, Trash2, UserRoundPlus } from '@lucide/vue';
import {
  useSuperAdminGroups,
  GROUP_TYPE_FILTERS,
} from '../composables/useSuperAdminGroups';
import { useSuperAdminFormat } from '../composables/useSuperAdminFormat';
import { useWindowVirtualList } from '../composables/useWindowVirtualList';
import AdminListToolbar from '../components/AdminListToolbar.vue';
import AdminSortHeader from '../components/AdminSortHeader.vue';
import DeleteGroupModal from '@/modules/groups/components/DeleteGroupModal.vue';
import Avatar from '@/modules/auth/components/Avatar.vue';
import type { GroupTypeFilter } from '../types';

/** A row's height until it is measured, in px. */
const ROW_HEIGHT = 48;
const COLUMN_COUNT = 7;

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
  invitingGroupId,
  inviteToGroup,
  groupPendingDelete,
  deleteModalOpen,
  deletingGroup,
  requestDeleteGroup,
  cancelDeleteGroup,
  confirmDeleteGroup,
} = useSuperAdminGroups();
const { fmtDate } = useSuperAdminFormat();
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
      <!-- Fixed columns: rows come and go while scrolling and must not
           resize them. -->
      <table class="table-fixed" :aria-rowcount="total + 1">
        <colgroup>
          <col class="w-64" />
          <col class="w-32" />
          <col class="w-64" />
          <col class="w-32" />
          <col class="w-32" />
          <col class="w-32" />
          <col class="w-36" />
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
            <th>{{ t('admin.groups.table.actions') }}</th>
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
            >
              <td>
                <div class="flex items-center gap-2 min-w-0">
                  <Avatar :name="g.name" :picture="g.avatarUrl" :size="6" />
                  <span class="truncate" :title="g.name">{{ g.name }}</span>
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
              <td class="py-0! px-2! min-w-0!">
                <div class="flex gap-0.5 justify-end">
                  <BaseTooltip
                    :content="t('admin.groups.open_tooltip')"
                    placement="bottom"
                  >
                    <BaseButton
                      size="sm"
                      :icon="ArrowUpRight"
                      @click="
                        router.push({
                          name: 'group-dashboard',
                          params: { groupId: g.id },
                        })
                      "
                    />
                  </BaseTooltip>
                  <BaseTooltip
                    :content="t('admin.groups.invite_tooltip')"
                    placement="bottom"
                  >
                    <BaseButton
                      size="sm"
                      :icon="UserRoundPlus"
                      :loading="invitingGroupId === g.id"
                      @click="inviteToGroup(g)"
                    />
                  </BaseTooltip>
                  <BaseTooltip
                    :content="t('admin.groups.delete_tooltip')"
                    placement="bottom"
                  >
                    <BaseButton
                      size="sm"
                      :icon="Trash2"
                      @click="requestDeleteGroup(g)"
                    />
                  </BaseTooltip>
                </div>
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

  <DeleteGroupModal
    :open="deleteModalOpen"
    :group-name="groupPendingDelete?.name ?? ''"
    :member-count="groupPendingDelete?.memberCount"
    :item-count="groupPendingDelete?.itemCount"
    :loading="deletingGroup"
    @cancel="cancelDeleteGroup"
    @confirm="confirmDeleteGroup"
  />
</template>
