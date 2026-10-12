<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AdminGroup } from '@/modules/admin/types';
import type { GroupAction } from '@/modules/admin/composables/useAdminGroupActions';

const I18N_BASE = 'admin.groups.details.manage';

type ActionRowId = 'open' | GroupAction;

const props = defineProps<{
  group: AdminGroup;
  pendingAction: GroupAction | null;
}>();

const emit = defineEmits<{
  open: [];
  invite: [];
  toggleBan: [];
  delete: [];
}>();

const { t } = useI18n();

interface ActionRow {
  action: ActionRowId;
  run: () => void;
  /** Solid red for what locks members out or cannot be undone. */
  danger: boolean;
}

const rows = computed<ActionRow[]>(() => [
  { action: 'open', run: () => emit('open'), danger: false },
  { action: 'invite', run: () => emit('invite'), danger: false },
  props.group.bannedAt
    ? { action: 'unban', run: () => emit('toggleBan'), danger: false }
    : { action: 'ban', run: () => emit('toggleBan'), danger: true },
  { action: 'delete', run: () => emit('delete'), danger: true },
]);
</script>

<template>
  <ul
    class="m-0 px-4 list-none divide-y divide-ghost-border rounded-xl border border-ghost-border bg-surface shadow-input"
  >
    <li
      v-for="row in rows"
      :key="row.action"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3"
    >
      <div class="min-w-0">
        <div class="font-semibold">
          {{ t(`${I18N_BASE}.${row.action}.label`) }}
        </div>
        <p class="m-0! text-sm text-on-ghost-muted">
          {{ t(`${I18N_BASE}.${row.action}.hint`) }}
        </p>
      </div>
      <BaseButton
        class="shrink-0"
        :variant="row.danger ? 'danger' : 'ghost'"
        :surface="!row.danger"
        :loading="pendingAction === row.action"
        :disabled="pendingAction !== null"
        @click="row.run"
      >
        {{ t(`${I18N_BASE}.${row.action}.button`) }}
      </BaseButton>
    </li>
  </ul>
</template>
