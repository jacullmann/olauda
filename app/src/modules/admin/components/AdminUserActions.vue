<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AdminUser } from '@/modules/admin/types';
import type { UserAction } from '@/modules/admin/composables/useAdminUserActions';

const I18N_BASE = 'admin.users.details.manage';

const props = defineProps<{
  user: AdminUser;
  /** The server refuses to delete an owner, so the action says why up front. */
  ownsGroup: boolean;
  pendingAction: UserAction | null;
}>();

const emit = defineEmits<{
  toggleBan: [];
  resetMfa: [];
  delete: [];
}>();

const { t } = useI18n();

interface ActionRow {
  action: UserAction;
  run: () => void;
  /** Solid red for what locks a person out or cannot be undone. */
  danger: boolean;
  disabledReason?: string;
}

const rows = computed<ActionRow[]>(() => {
  const { user } = props;
  const rows: ActionRow[] = [];
  if (!user.isSuperadmin) {
    rows.push(
      user.isBanned
        ? { action: 'unban', run: () => emit('toggleBan'), danger: false }
        : { action: 'ban', run: () => emit('toggleBan'), danger: true },
    );
  }
  if (user.mfaEnabled) {
    rows.push({
      action: 'reset_mfa',
      run: () => emit('resetMfa'),
      danger: false,
    });
  }
  if (!user.isSuperadmin) {
    rows.push({
      action: 'delete',
      run: () => emit('delete'),
      danger: true,
      disabledReason: props.ownsGroup
        ? t(`${I18N_BASE}.delete.owns_group`)
        : undefined,
    });
  }
  return rows;
});
</script>

<template>
  <div
    class="rounded-xl border border-ghost-border bg-surface shadow-input px-4"
  >
    <p
      v-if="user.isSuperadmin"
      class="py-3 m-0 text-sm text-on-ghost-muted"
      :class="{ 'border-b border-ghost-border': rows.length }"
    >
      {{ t(`${I18N_BASE}.superadmin_hint`) }}
    </p>
    <ul class="m-0 p-0 list-none divide-y divide-ghost-border">
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
            {{ row.disabledReason ?? t(`${I18N_BASE}.${row.action}.hint`) }}
          </p>
        </div>
        <BaseButton
          class="shrink-0"
          :variant="row.danger ? 'danger' : 'ghost'"
          :surface="!row.danger"
          :loading="pendingAction === row.action"
          :disabled="!!row.disabledReason || pendingAction !== null"
          @click="row.run"
        >
          {{ t(`${I18N_BASE}.${row.action}.button`) }}
        </BaseButton>
      </li>
    </ul>
  </div>
</template>
