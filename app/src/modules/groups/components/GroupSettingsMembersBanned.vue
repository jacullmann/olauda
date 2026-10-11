<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupBans } from '@/modules/groups/composables/useGroupBans';
import { Ban } from '@lucide/vue';

const { bannedUsers, loadingBannedUsers: loading, revertBan } = useGroupBans();

const { t, locale } = useI18n();
const { checkPermission } = useGroups();
const canModerateMembers = computed(() => checkPermission('moderate_members'));

function bannedOnLabel(bannedAt: string): string {
  return t('groups.settings.members.ban_list.banned_on', {
    date: new Date(bannedAt).toLocaleDateString(locale.value),
  });
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div
      v-if="loading && bannedUsers.length === 0"
      class="flex justify-center p-8"
    >
      <BaseSpinner />
    </div>
    <BaseEmptyState
      v-else-if="bannedUsers.length === 0"
      class="flex-1"
      :icon="Ban"
    >
      {{ t('groups.settings.members.ban_list.empty') }}
    </BaseEmptyState>
    <div v-else class="flex w-full max-w-200 flex-col mx-auto">
      <template v-for="(user, index) in bannedUsers" :key="user.userId">
        <div v-if="index > 0" class="separator md:ml-14 md:mr-3"></div>
        <div class="flex items-center justify-between py-3 gap-2">
          <div class="flex items-center gap-4 min-w-0">
            <BaseAvatar
              class="max-md:hidden"
              :name="user.generatedName"
              :size="10"
            />
            <div class="flex flex-col gap-1 min-w-0">
              <span
                class="font-semibold text-base/tight whitespace-nowrap overflow-hidden text-ellipsis"
                >{{ user.generatedName }}</span
              >
              <span class="md:hidden text-on-ghost-muted text-sm/4">{{
                bannedOnLabel(user.bannedAt)
              }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="max-md:hidden text-on-ghost-muted text-sm">{{
              bannedOnLabel(user.bannedAt)
            }}</span>

            <BaseButton
              :disabled="!canModerateMembers"
              variant="ghost"
              @click="revertBan(user.userId)"
            >
              {{ t('groups.settings.members.ban_list.actions.unban') }}
            </BaseButton>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
