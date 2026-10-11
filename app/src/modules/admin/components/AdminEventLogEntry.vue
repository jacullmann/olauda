<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Shield } from '@lucide/vue';
import type { EventLogEntry } from '@/modules/admin/types';
import { useLogFormat } from '@/modules/admin/composables/useLogFormat';
import AdminEventLogFields from './AdminEventLogFields.vue';

export type EventLogPivot = 'type' | 'ip' | 'groupId';

const I18N_BASE = 'admin.log.entry';

const props = defineProps<{
  entry: EventLogEntry;
  /** The account the log is scoped to, which every entry concerns. */
  scopedUserId?: string;
}>();

const emit = defineEmits<{
  (e: 'pivot', key: EventLogPivot, value: string): void;
}>();

const { t } = useI18n();
const { eventLabel, fields, deviceName, time } = useLogFormat();

interface Account {
  role: 'user' | 'actor';
  id: string;
  /** Gone once the account was deleted; the id outlives it. */
  email: string | null;
}

/** The accounts worth naming: neither the scoped one nor the same one twice. */
const accounts = computed(() => {
  const { userId, userEmail, actorId, actorEmail } = props.entry;
  const result: Account[] = [];
  if (userId && userId !== props.scopedUserId) {
    result.push({ role: 'user', id: userId, email: userEmail });
  }
  if (actorId && actorId !== userId && actorId !== props.scopedUserId) {
    result.push({ role: 'actor', id: actorId, email: actorEmail });
  }
  return result;
});

function pivot(key: EventLogPivot) {
  const { type, ipAddress, groupId } = props.entry;
  const value = { type, ip: ipAddress, groupId }[key];
  if (value) emit('pivot', key, value);
}

const label = computed(() => eventLabel(props.entry.source, props.entry.type));
const details = computed(() => fields(props.entry.metadata));
const device = computed(() =>
  props.entry.userAgent
    ? { name: deviceName(props.entry.userAgent), raw: props.entry.userAgent }
    : null,
);
</script>

<template>
  <div class="flex items-baseline justify-between gap-3">
    <span class="min-w-0 break-words">
      <Shield
        v-if="entry.source === 'security'"
        :size="14"
        class="inline mr-1 align-[-2px] text-on-ghost-muted"
        :aria-label="t('admin.log.sources.security')"
      />
      <button
        type="button"
        class="font-semibold text-left cursor-pointer hover:underline"
        :title="t(`${I18N_BASE}.filter_type`)"
        @click="pivot('type')"
      >
        {{ label }}
      </button>
      <span
        v-if="entry.outcome === 'failure'"
        class="ml-1.5 text-xs font-semibold text-danger"
      >
        {{ t('admin.log.outcomes.failure') }}
      </span>
    </span>
    <time
      :datetime="entry.createdAt"
      class="shrink-0 text-xs text-on-ghost-muted tabular-nums"
      >{{ time(entry.createdAt) }}</time
    >
  </div>

  <AdminEventLogFields :fields="details">
    <template v-for="account in accounts" :key="account.role">
      <dt class="text-on-ghost-muted">
        {{ t(`${I18N_BASE}.${account.role}`) }}
      </dt>
      <dd class="m-0 min-w-0 break-words">
        <RouterLink
          v-if="account.email"
          :to="{ name: 'admin-user', params: { userId: account.id } }"
          class="hover:underline"
          >{{ account.email }}</RouterLink
        >
        <span v-else class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-on-ghost-muted">
            {{ t(`${I18N_BASE}.deleted_account`) }}
          </span>
          <span class="font-mono text-xs select-all break-all">
            {{ account.id }}
          </span>
        </span>
      </dd>
    </template>
    <template v-if="entry.groupId">
      <dt class="text-on-ghost-muted">{{ t(`${I18N_BASE}.group`) }}</dt>
      <dd class="m-0 min-w-0">
        <button
          type="button"
          class="text-left break-words cursor-pointer hover:underline"
          :class="{ 'font-mono text-xs/5': !entry.groupName }"
          :title="t(`${I18N_BASE}.filter_group`)"
          @click="pivot('groupId')"
        >
          {{ entry.groupName ?? entry.groupId }}
        </button>
      </dd>
    </template>
    <template v-if="entry.ipAddress">
      <dt class="text-on-ghost-muted">{{ t(`${I18N_BASE}.ip`) }}</dt>
      <dd class="m-0">
        <button
          type="button"
          class="font-mono text-xs/5 cursor-pointer hover:underline"
          :title="t(`${I18N_BASE}.filter_ip`)"
          @click="pivot('ip')"
        >
          {{ entry.ipAddress }}
        </button>
      </dd>
    </template>
    <template v-if="device">
      <dt class="text-on-ghost-muted">{{ t(`${I18N_BASE}.device`) }}</dt>
      <dd class="m-0 break-words" :title="device.raw">{{ device.name }}</dd>
    </template>
  </AdminEventLogFields>
</template>
