<script setup lang="ts">
import {
  RefreshCw,
  CircleMinus,
  UserRoundPlus,
  Ban,
  Search,
  UsersRound,
  Mic,
  MicOff,
} from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { GroupMember, MemberRole } from '@/modules/groups/types';
import { useGroupMembers } from '@/modules/groups/composables/useGroupMembers';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { rankByQuery } from '@/common/utils/searchRank';

const { t, locale } = useI18n();
const router = useRouter();

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return t('auth.sessions.time.just_now');
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      const rtf = new Intl.RelativeTimeFormat(locale.value, {
        numeric: 'always',
      });
      if (diffHours < 1) {
        return rtf.format(-diffMins, 'minute');
      }
      return rtf.format(-diffHours, 'hour');
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      const rtf = new Intl.RelativeTimeFormat(locale.value, {
        numeric: 'auto',
      });
      return rtf.format(-diffDays, 'day');
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      const rtf = new Intl.RelativeTimeFormat(locale.value, {
        numeric: 'always',
      });
      return rtf.format(-diffMonths, 'month');
    }

    const diffYears = Math.floor(diffDays / 365);
    const rtf = new Intl.RelativeTimeFormat(locale.value, {
      numeric: 'always',
    });
    return rtf.format(-diffYears, 'year');
  } catch {
    return '';
  }
}

const {
  members,
  loadingMembers: loading,
  loadMembers,
  changeRole,
  removeMember,
  setMuted,
  transferOwnership,
} = useGroupMembers();

const { checkPermission } = useGroups();
const userStore = useUserStore();
const canModerateMembers = computed(() => checkPermission('moderate_members'));
const canChangeAnyRole = computed(() =>
  members.value.some((member) => member.assignableRoles.length > 0),
);

const DROPDOWN_ROLES: readonly MemberRole[] = [
  'user',
  'moderator',
  'admin',
  'owner',
];

const roleLabels = computed<Record<MemberRole, string>>(() => ({
  owner: t('common.roles.owner'),
  admin: t('common.roles.admin'),
  moderator: t('common.roles.moderator'),
  user: t('common.roles.member'),
}));

const memberCountLabel = computed(() =>
  members.value.length === 1
    ? t('groups.settings.members.count_one')
    : t('groups.settings.members.count_other', {
        count: members.value.length,
      }),
);

const searchQuery = ref('');
const filteredMembers = computed(() =>
  rankByQuery(members.value, searchQuery.value, (member) => [
    { text: member.generatedName, weight: 1 },
    { text: roleLabels.value[member.role], weight: 0.8 },
  ]),
);

function isSelf(member: GroupMember): boolean {
  return member.userId === userStore.user?.id;
}

function muteActionLabel(member: GroupMember): string {
  return member.muted
    ? t('groups.settings.members.actions.unmute')
    : t('groups.settings.members.actions.mute');
}

function isMemberRole(value: string): value is MemberRole {
  return (DROPDOWN_ROLES as readonly string[]).includes(value);
}

function roleOptionsFor(member: GroupMember) {
  return DROPDOWN_ROLES.map((role) => ({
    label: roleLabels.value[role],
    value: role,
    disabled: role !== member.role && !member.assignableRoles.includes(role),
  }));
}

const groupId = useGroupPageId();

function goToInvites() {
  void router.push({
    name: 'group-admin',
    params: { groupId, tab: 'members', subTab: 'invites' },
  });
}

function goToBanned() {
  void router.push({
    name: 'group-admin',
    params: { groupId, tab: 'members', subTab: 'banned' },
  });
}

function onRoleChange(member: GroupMember, value: string) {
  if (!isMemberRole(value) || value === member.role) return;

  if (value === 'owner') {
    void transferOwnership(member.userId);
  } else {
    void changeRole(member.userId, value);
  }
}

const removeModal = ref({
  isOpen: false,
  userId: '',
  userName: '',
  ban: false,
});

function openRemoveModal(userId: string, name: string) {
  removeModal.value = {
    isOpen: true,
    userId,
    userName: name,
    ban: false,
  };
}

function closeRemoveModal() {
  removeModal.value.isOpen = false;
}

function confirmRemove() {
  void removeMember(removeModal.value.userId, removeModal.value.ban);
  closeRemoveModal();
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Subpages navigation list above the members list -->
    <div
      v-if="canModerateMembers"
      class="flex max-w-200 flex-col mx-auto mb-6 max-md:-mx-6 md:w-full"
    >
      <BaseList @click="goToInvites">
        <template #icon>
          <UserRoundPlus :size="20" :stroke-width="1.8" />
        </template>
        <template #label>
          {{ t('groups.settings.members.invite_links.title') }}
        </template>
      </BaseList>

      <BaseList :separator="false" @click="goToBanned">
        <template #icon>
          <Ban :size="20" :stroke-width="1.8" />
        </template>
        <template #label>
          {{ t('groups.settings.members.ban_list.title') }}
        </template>
      </BaseList>
    </div>

    <BasePageHeader>
      <template #info>
        <BaseInfoButton
          :tooltip="t('groups.settings.members.info.tooltip')"
          :title="t('groups.settings.members.title')"
        >
          <h3>{{ t('groups.settings.members.info.headline') }}</h3>

          <h3>{{ t('groups.settings.members.info.list_title') }}</h3>
          <p>{{ t('groups.settings.members.info.list_text') }}</p>

          <h3>{{ t('groups.settings.members.info.role_title') }}</h3>
          <p>{{ t('groups.settings.members.info.role_text') }}</p>

          <h3>{{ t('groups.settings.members.info.mute_title') }}</h3>
          <p>{{ t('groups.settings.members.info.mute_text') }}</p>

          <h3>{{ t('groups.settings.members.info.remove_title') }}</h3>
          <p>{{ t('groups.settings.members.info.remove_text') }}</p>
        </BaseInfoButton>
      </template>

      <template #action>
        <BaseTooltip :content="t('common.buttons.refresh')">
          <BaseButton
            :disabled="loading"
            variant="ghost"
            :icon="RefreshCw"
            @click="loadMembers"
          />
        </BaseTooltip>
      </template>
    </BasePageHeader>

    <div v-if="loading && members.length === 0" class="flex justify-center p-8">
      <BaseSpinner />
    </div>
    <BaseEmptyState
      v-else-if="members.length === 0"
      class="flex-1"
      :icon="UsersRound"
    >
      {{ t('groups.settings.members.list.empty') }}
    </BaseEmptyState>

    <div v-else class="flex w-full max-w-200 flex-1 flex-col mx-auto">
      <div class="mb-4">
        <BaseSearchInput
          id="group-member-search"
          v-model="searchQuery"
          :placeholder="t('groups.settings.members.search_placeholder')"
        />
      </div>

      <p class="text-on-ghost-muted text-sm mt-0! mb-2!">
        {{ memberCountLabel }}
      </p>

      <BaseEmptyState
        v-if="filteredMembers.length === 0"
        class="flex-1"
        :icon="Search"
      >
        {{
          t('common.search_results.empty_title', { query: searchQuery.trim() })
        }}
        <template #message>{{
          t('common.search_results.empty_message')
        }}</template>
      </BaseEmptyState>

      <template v-for="(member, index) in filteredMembers" :key="member.userId">
        <div v-if="index > 0" class="separator md:ml-14 md:mr-3"></div>
        <div class="flex items-center justify-between py-3 gap-2">
          <div class="flex items-center gap-4 min-w-0">
            <BaseAvatar
              class="max-md:hidden"
              :name="member.generatedName"
              :size="10"
            />
            <div class="flex min-w-0 flex-col gap-1">
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="font-semibold text-base/tight whitespace-nowrap overflow-hidden text-ellipsis"
                  >{{ member.generatedName }}</span
                >
                <span
                  v-if="isSelf(member)"
                  class="shrink-0 rounded-full bg-action px-2 text-xs/5 font-semibold text-on-action"
                  >{{ t('groups.settings.members.you') }}</span
                >
                <!-- Narrow rows keep only the icon; the label stays for screen readers. -->
                <span
                  v-if="member.muted"
                  class="flex shrink-0 items-center rounded-full bg-ghost-hover px-2 text-xs/5 font-semibold text-on-ghost-muted max-md:py-1"
                  :title="t('groups.settings.members.muted')"
                >
                  <MicOff :size="12" class="md:hidden" aria-hidden="true" />
                  <span class="max-md:sr-only">{{
                    t('groups.settings.members.muted')
                  }}</span>
                </span>
              </div>
              <span class="md:hidden truncate text-on-ghost-muted text-sm/4">{{
                t('groups.settings.members.joined', {
                  time: formatRelativeTime(member.joinedAt),
                })
              }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="max-md:hidden text-on-ghost-muted text-sm">{{
              t('groups.settings.members.joined', {
                time: formatRelativeTime(member.joinedAt),
              })
            }}</span>

            <BaseSelect
              v-if="canChangeAnyRole"
              :model-value="member.role"
              :disabled="member.assignableRoles.length === 0"
              :form="false"
              classes="w-33!"
              :options="roleOptionsFor(member)"
              @update:model-value="(val: string) => onRoleChange(member, val)"
            />
            <span v-else class="text-sm text-on-ghost-muted">{{
              roleLabels[member.role]
            }}</span>

            <BaseTooltip
              v-if="canModerateMembers"
              :content="muteActionLabel(member)"
              placement="bottom"
            >
              <BaseButton
                variant="ghost"
                :disabled="!member.canMute"
                :icon="member.muted ? Mic : MicOff"
                :aria-label="muteActionLabel(member)"
                @click="setMuted(member.userId, !member.muted)"
              />
            </BaseTooltip>

            <BaseTooltip
              v-if="canModerateMembers"
              :content="t('groups.settings.members.actions.remove')"
              placement="bottom"
            >
              <BaseButton
                variant="ghost"
                :disabled="!member.canRemove"
                :icon="CircleMinus"
                @click="openRemoveModal(member.userId, member.generatedName)"
              />
            </BaseTooltip>
          </div>
        </div>
      </template>
    </div>

    <BaseModal
      :open="removeModal.isOpen"
      danger
      :submit="confirmRemove"
      @cancel="closeRemoveModal"
    >
      <template #title>{{
        t('groups.settings.members.remove_modal.title')
      }}</template>

      <template #content>
        <i18n-t
          keypath="groups.settings.members.remove_modal.confirm"
          tag="p"
          class="m-0!"
        >
          <template #name>
            <strong>{{ removeModal.userName }}</strong>
          </template>
        </i18n-t>
        <p class="m-0!">
          {{ t('groups.settings.members.remove_modal.rejoin_info') }}
        </p>

        <BaseCheckbox v-model="removeModal.ban">
          <i18n-t
            keypath="groups.settings.members.remove_modal.ban_checkbox"
            tag="span"
          >
            <template #name>
              <strong>{{ removeModal.userName }}</strong>
            </template>
          </i18n-t>
        </BaseCheckbox>
      </template>

      <template #action-text>
        {{ t('groups.settings.members.remove_modal.submit_button') }}
      </template>
    </BaseModal>
  </div>
</template>
