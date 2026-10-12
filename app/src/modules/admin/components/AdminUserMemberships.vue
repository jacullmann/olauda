<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { MemberRole, AdminMembership } from '@/modules/admin/types';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';

defineProps<{
  memberships: AdminMembership[];
  changingGroupId: string | null;
}>();

const emit = defineEmits<{
  changeRole: [membership: AdminMembership, role: MemberRole];
}>();

const { t } = useI18n();
const { fmtDate } = useAdminFormat();

const ROLE_LABEL_KEYS: Record<MemberRole, string> = {
  owner: 'common.roles.owner',
  admin: 'common.roles.admin',
  moderator: 'common.roles.moderator',
  user: 'common.roles.member',
};

function roleOptions(current: MemberRole, assignable: MemberRole[]) {
  return [current, ...assignable].map((role) => ({
    value: role,
    label: t(ROLE_LABEL_KEYS[role]),
  }));
}
</script>

<template>
  <p v-if="!memberships.length" class="text-sm text-on-ghost-muted m-0">
    {{ t('admin.users.details.no_groups') }}
  </p>
  <ul
    v-else
    class="m-0 p-0 list-none rounded-xl border border-ghost-border bg-surface shadow-input divide-y divide-ghost-border"
  >
    <li
      v-for="m in memberships"
      :key="m.groupId"
      class="flex items-center justify-between gap-3 px-4 py-3"
    >
      <div class="min-w-0">
        <RouterLink
          :to="{ name: 'admin-group', params: { adminGroupId: m.groupId } }"
          class="block font-semibold truncate hover:underline"
          >{{ m.groupName }}</RouterLink
        >
        <div class="text-sm text-on-ghost-muted">
          {{ t('admin.users.details.joined', { date: fmtDate(m.joinedAt) }) }}
        </div>
      </div>
      <div class="w-40 shrink-0">
        <BaseSelect
          :model-value="m.role"
          :options="roleOptions(m.role, m.assignableRoles)"
          :disabled="!m.assignableRoles.length || changingGroupId === m.groupId"
          :title="m.groupName"
          @update:model-value="
            (role) => emit('changeRole', m, role as MemberRole)
          "
        />
      </div>
    </li>
  </ul>
</template>
