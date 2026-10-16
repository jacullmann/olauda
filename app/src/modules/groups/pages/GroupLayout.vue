<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Ban } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import GroupMutedNotice from '@/modules/groups/components/GroupMutedNotice.vue';

const { t } = useI18n();
const { findGroup } = useGroups();
const userStore = useUserStore();
const groupId = useGroupPageId();

// Superadmins keep access to review a banned group, as the server lets them.
const isLockedOut = computed(
  () => findGroup(groupId)?.banned === true && !userStore.isSuperadmin,
);
</script>

<template>
  <BaseEmptyState v-if="isLockedOut" :icon="Ban" class="flex-1">
    {{ t('groups.banned.title') }}
    <template #message>{{ t('groups.banned.message') }}</template>
  </BaseEmptyState>
  <template v-else>
    <GroupMutedNotice class="mx-4 mt-4" />
    <router-view />
  </template>
</template>
