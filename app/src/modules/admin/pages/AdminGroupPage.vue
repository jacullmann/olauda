<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ChevronLeft } from '@lucide/vue';
import { useAdminGroup } from '@/modules/admin/composables/useAdminGroup';
import { useAdminGroupActions } from '@/modules/admin/composables/useAdminGroupActions';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import AdminGroupActions from '@/modules/admin/components/AdminGroupActions.vue';
import AdminEventLogLink from '@/modules/admin/components/AdminEventLogLink.vue';
import GroupDeleteModal from '@/modules/groups/components/GroupDeleteModal.vue';

const I18N_BASE = 'admin.groups.details';

const props = defineProps<{
  groupId: string;
}>();

const { t, n } = useI18n();
const router = useRouter();
const { fmtDate, fmtDateTime } = useAdminFormat();
const { group, state, reload } = useAdminGroup(() => props.groupId);
const {
  pendingAction,
  invite,
  toggleBan,
  deleteModalOpen,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useAdminGroupActions(group);

const facts = computed(() => {
  const g = group.value;
  if (!g) return [];
  return [
    { key: 'type', value: t(`admin.groups.filters.${g.groupType}`) },
    { key: 'created', value: fmtDate(g.createdAt) },
    { key: 'members', value: n(g.memberCount) },
    { key: 'tasks', value: n(g.itemCount) },
    ...(g.bannedAt
      ? [{ key: 'banned_since', value: fmtDateTime(g.bannedAt) }]
      : []),
  ];
});

/**
 * Stepping back returns to the page this one was opened from, as it was left.
 * A page opened from a link has nothing of this app behind it to step back to.
 */
function leave() {
  if (router.options.history.state.back) router.back();
  else void router.push({ name: 'admin-groups' });
}

function openGroup() {
  void router.push({
    name: 'group-dashboard',
    params: { groupId: props.groupId },
  });
}

async function onConfirmDelete() {
  if (await confirmDelete()) leave();
}

watchEffect(() => {
  if (group.value) document.title = `${group.value.name} | Olauda`;
});
</script>

<template>
  <div class="flex min-h-full max-w-3xl flex-col">
    <BaseButton
      variant="ghost"
      :icon="ChevronLeft"
      class="self-start -ml-3 mb-2"
      @click="leave"
    >
      {{ t(`${I18N_BASE}.back`) }}
    </BaseButton>

    <div v-if="state === 'loading' && !group" class="flex justify-center p-10">
      <BaseSpinner on="ghost" size="24px" />
    </div>
    <BaseEmptyState v-else-if="state === 'not-found'" class="flex-1">
      {{ t(`${I18N_BASE}.not_found`) }}
    </BaseEmptyState>
    <BaseLoadError v-else-if="state === 'failed'" @retry="reload">
      {{ t('admin.groups.errors.load_group') }}
    </BaseLoadError>
    <div
      v-else-if="group"
      class="flex flex-col gap-8"
      :class="{ 'opacity-60 pointer-events-none': state === 'loading' }"
      :aria-busy="state === 'loading'"
    >
      <header class="flex items-center gap-4">
        <BaseAvatar :name="group.name" :picture="group.avatarUrl" :size="14" />
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex flex-wrap items-baseline gap-x-3">
            <h2 class="min-w-0 break-words">{{ group.name }}</h2>
            <span
              class="text-sm font-semibold"
              :class="group.bannedAt ? 'text-danger' : 'text-success'"
            >
              {{
                t(`admin.groups.status.${group.bannedAt ? 'banned' : 'active'}`)
              }}
            </span>
          </div>
          <div class="text-on-ghost-muted break-all">
            {{ t(`${I18N_BASE}.owner`) }}
            <RouterLink
              :to="{ name: 'admin-user', params: { userId: group.ownerId } }"
              class="hover:underline"
              >{{ group.ownerEmail }}</RouterLink
            >
          </div>
          <div
            class="font-mono text-xs text-on-ghost-subtle select-all break-all"
          >
            {{ group.id }}
          </div>
        </div>
      </header>

      <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 m-0">
        <div v-for="fact in facts" :key="fact.key" class="min-w-0">
          <dt class="text-sm text-on-ghost-muted">
            {{ t(`${I18N_BASE}.facts.${fact.key}`) }}
          </dt>
          <dd class="m-0 font-semibold tabular-nums">{{ fact.value }}</dd>
        </div>
      </dl>

      <section class="flex flex-col gap-3">
        <h3>{{ t(`${I18N_BASE}.manage.title`) }}</h3>
        <AdminGroupActions
          :group="group"
          :pending-action="pendingAction"
          @open="openGroup"
          @invite="invite"
          @toggle-ban="toggleBan"
          @delete="requestDelete"
        />
      </section>

      <AdminEventLogLink :filter="{ groupId: group.id }" />
    </div>
  </div>

  <GroupDeleteModal
    :open="deleteModalOpen"
    :group-name="group?.name ?? ''"
    :member-count="group?.memberCount"
    :item-count="group?.itemCount"
    :loading="pendingAction === 'delete'"
    @cancel="cancelDelete"
    @confirm="onConfirmDelete"
  />
</template>
