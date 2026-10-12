<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ChevronLeft } from '@lucide/vue';
import { useAdminUser } from '@/modules/admin/composables/useAdminUser';
import { useAdminUserActions } from '@/modules/admin/composables/useAdminUserActions';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import AdminUserActions from '@/modules/admin/components/AdminUserActions.vue';
import AdminEventLogLink from '@/modules/admin/components/AdminEventLogLink.vue';
import AdminUserMemberships from '@/modules/admin/components/AdminUserMemberships.vue';

const I18N_BASE = 'admin.users.details';

const props = defineProps<{
  userId: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { fmtDate, fmtDateTime } = useAdminFormat();
const { user, memberships, state, reload, changingGroupId, changeRole } =
  useAdminUser(() => props.userId);
const { pendingAction, toggleBan, resetMfa, deleteUser } =
  useAdminUserActions(user);

const ownsGroup = computed(() =>
  memberships.value.some((m) => m.role === 'owner'),
);

const status = computed(() => {
  if (!user.value) return null;
  if (user.value.isSuperadmin)
    return { key: 'admin', class: 'text-indigo-500' };
  if (user.value.isBanned) return { key: 'banned', class: 'text-danger' };
  return { key: 'active', class: 'text-success' };
});

const facts = computed(() => {
  const u = user.value;
  if (!u) return [];
  return [
    { key: 'registered', value: fmtDate(u.createdAt) },
    {
      key: 'last_login',
      value: u.lastLoginAt
        ? fmtDateTime(u.lastLoginAt)
        : t(`${I18N_BASE}.facts.never`),
    },
    {
      key: 'mfa',
      value: t(`${I18N_BASE}.facts.${u.mfaEnabled ? 'mfa_on' : 'mfa_off'}`),
    },
    { key: 'groups', value: String(memberships.value.length) },
  ];
});

/**
 * Stepping back returns to the page this one was opened from, as it was left.
 * A page opened from a link has nothing of this app behind it to step back to.
 */
function leave() {
  if (router.options.history.state.back) router.back();
  else void router.push({ name: 'admin-users' });
}

async function onDelete() {
  if (await deleteUser()) leave();
}

watchEffect(() => {
  if (user.value) document.title = `${user.value.username} | Olauda`;
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

    <div v-if="state === 'loading' && !user" class="flex justify-center p-10">
      <BaseSpinner on="ghost" size="24px" />
    </div>
    <BaseEmptyState v-else-if="state === 'not-found'" class="flex-1">
      {{ t(`${I18N_BASE}.not_found`) }}
    </BaseEmptyState>
    <BaseLoadError v-else-if="state === 'failed'" @retry="reload">
      {{ t('admin.users.errors.load_user') }}
    </BaseLoadError>
    <div
      v-else-if="user"
      class="flex flex-col gap-8"
      :class="{ 'opacity-60 pointer-events-none': state === 'loading' }"
      :aria-busy="state === 'loading'"
    >
      <header class="flex flex-col gap-1">
        <div class="flex flex-wrap items-baseline gap-x-3">
          <h2 class="min-w-0 break-words">{{ user.username }}</h2>
          <span
            v-if="status"
            class="text-sm font-semibold"
            :class="status.class"
          >
            {{ t(`admin.users.status.${status.key}`) }}
          </span>
        </div>
        <div class="text-on-ghost-muted break-all">{{ user.email }}</div>
        <div
          class="font-mono text-xs text-on-ghost-subtle select-all break-all"
        >
          {{ user.id }}
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
        <AdminUserActions
          :user="user"
          :owns-group="ownsGroup"
          :pending-action="pendingAction"
          @toggle-ban="toggleBan"
          @reset-mfa="resetMfa"
          @delete="onDelete"
        />
      </section>

      <section class="flex flex-col gap-3">
        <h3>{{ t(`${I18N_BASE}.groups`) }}</h3>
        <AdminUserMemberships
          :memberships="memberships"
          :changing-group-id="changingGroupId"
          @change-role="changeRole"
        />
      </section>

      <AdminEventLogLink :filter="{ userId: user.id }" />
    </div>
  </div>
</template>
