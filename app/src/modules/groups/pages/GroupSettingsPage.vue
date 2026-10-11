<script setup lang="ts">
import { markRaw, computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  CalendarDays,
  Megaphone,
  UsersRound,
  Key,
  Library,
  Cog,
  GraduationCap,
} from '@lucide/vue';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useHeaderOverlay } from '@/shell/composables/useHeaderOverlay';
import { useGroupSettingsAccess } from '@/modules/groups/composables/useGroupSettingsAccess';
import { useReturnRoute } from '@/common/composables/useReturnRoute';
import type { NavListItem } from '@/common/types';

import GroupSettingsMembers from '@/modules/groups/components/GroupSettingsMembers.vue';
import GroupSettingsMembersBanned from '@/modules/groups/components/GroupSettingsMembersBanned.vue';
import GroupSettingsMembersInvites from '@/modules/groups/components/GroupSettingsMembersInvites.vue';
import GroupSettingsPermissions from '@/modules/groups/components/GroupSettingsPermissions.vue';
import GroupSettingsSchedule from '@/modules/groups/components/GroupSettingsSchedule.vue';
import GroupSettingsAnnouncements from '@/modules/groups/components/GroupSettingsAnnouncements.vue';
import GroupSettingsSubjects from '@/modules/groups/components/GroupSettingsSubjects.vue';
import GroupSettingsGeneral from '@/modules/groups/components/GroupSettingsGeneral.vue';
import GroupSettingsAppearance from '@/modules/groups/components/GroupSettingsAppearance.vue';
import GroupSettingsMyCourses from '@/modules/groups/components/GroupSettingsMyCourses.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const groupId = useGroupPageId();

// Returning to a settings page would bounce between the two pages' back buttons.
const { leave: leaveSettings } = useReturnRoute(
  () => ({
    name: 'group-dashboard',
    params: { groupId },
  }),
  ['group-admin', 'account-settings'],
);

const activeTab = computed<string>({
  get() {
    return (route.params.tab as string) || '';
  },
  set(val) {
    if (val) {
      void router.push({
        name: 'group-admin',
        params: { groupId, tab: val },
      });
    } else {
      void router.push({
        name: 'group-admin',
        params: { groupId },
      });
    }
  },
});

const { hasOwnerRights } = useGroupSettingsAccess();

const navItems = computed<NavListItem[]>(() => [
  {
    id: 'courses',
    label: t('groups.settings.nav.courses'),
    icon: markRaw(GraduationCap),
  },
  {
    id: 'general',
    label: t('groups.settings.nav.general'),
    icon: markRaw(Cog),
  },
  {
    id: 'members',
    label: t('groups.settings.nav.members'),
    icon: markRaw(UsersRound),
  },
  {
    id: 'permissions',
    label: t('groups.settings.nav.permissions'),
    icon: markRaw(Key),
  },
  {
    id: 'schedule',
    label: t('groups.settings.nav.schedule'),
    icon: markRaw(CalendarDays),
  },
  {
    id: 'subjects',
    label: t('groups.settings.nav.subjects'),
    icon: markRaw(Library),
  },
  {
    id: 'announcements',
    label: t('groups.settings.nav.announcements'),
    icon: markRaw(Megaphone),
  },
]);

const transitionDirection = ref<'forward' | 'backward'>('forward');

const paneKey = computed(() =>
  activeTab.value
    ? [activeTab.value, route.params.subTab].filter(Boolean).join('-')
    : 'master',
);

const activeTabLabel = computed(() => {
  if (route.params.tab === 'subjects' && route.params.subTab) {
    return t('groups.settings.nav.subject_info');
  }
  if (route.params.tab === 'members' && route.params.subTab === 'banned') {
    return t('groups.settings.members.ban_list.title');
  }
  if (route.params.tab === 'members' && route.params.subTab === 'invites') {
    return t('groups.settings.members.invite_links.title');
  }
  const item = navItems.value.find((n) => n.id === activeTab.value);
  return item ? item.label : '';
});

watch(
  () => ({
    tab: route.params.tab as string | undefined,
    subTab: route.params.subTab as string | undefined,
  }),
  (newVal, oldVal) => {
    if (newVal.tab !== oldVal?.tab) {
      if (newVal.tab && !oldVal?.tab) {
        transitionDirection.value = 'forward';
      } else if (!newVal.tab && oldVal?.tab) {
        transitionDirection.value = 'backward';
      }
    } else if (newVal.subTab !== oldVal?.subTab) {
      if (newVal.subTab && !oldVal?.subTab) {
        transitionDirection.value = 'forward';
      } else if (!newVal.subTab && oldVal?.subTab) {
        transitionDirection.value = 'backward';
      }
    }
  },
);

function selectTab(id: string) {
  transitionDirection.value = 'forward';
  activeTab.value = id;
}

function goBack() {
  transitionDirection.value = 'backward';
  if (route.params.subTab) {
    void router.push({
      name: 'group-admin',
      params: { groupId, tab: activeTab.value },
    });
  } else {
    activeTab.value = '';
  }
}

useHeaderOverlay(() =>
  activeTab.value
    ? { title: activeTabLabel.value, back: goBack }
    : { title: t('groups.settings.title'), back: leaveSettings },
);
</script>

<template>
  <BasePaneTransition :pane-key="paneKey" :direction="transitionDirection">
    <template v-if="!activeTab">
      <div class="flex-1 py-4 md:p-4">
        <div class="flex flex-col max-w-200 mx-auto">
          <GroupSettingsAppearance class="px-6 md:px-3.5 pb-6" />

          <BaseList
            v-for="(item, index) in navItems"
            :key="item.id"
            :separator="index !== navItems.length - 1"
            @click="selectTab(item.id)"
          >
            <template #icon>
              <component :is="item.icon" :size="20" :stroke-width="1.8" />
            </template>
            <template #label>
              {{ item.label }}
            </template>
          </BaseList>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-1 flex-col p-6 pt-4 md:py-8">
        <div class="flex w-full max-w-250 flex-1 flex-col mx-auto">
          <GroupSettingsMyCourses v-if="activeTab === 'courses'" />

          <GroupSettingsMembers
            v-if="activeTab === 'members' && !route.params.subTab"
          />

          <GroupSettingsMembersBanned
            v-else-if="
              activeTab === 'members' && route.params.subTab === 'banned'
            "
          />

          <GroupSettingsMembersInvites
            v-else-if="
              activeTab === 'members' && route.params.subTab === 'invites'
            "
          />

          <GroupSettingsSchedule v-if="activeTab === 'schedule'" />

          <GroupSettingsAnnouncements v-if="activeTab === 'announcements'" />

          <GroupSettingsSubjects v-if="activeTab === 'subjects'" />

          <GroupSettingsPermissions
            v-if="activeTab === 'permissions'"
            :can-manage="hasOwnerRights"
          />

          <GroupSettingsGeneral v-if="activeTab === 'general'" />
        </div>
      </div>
    </template>
  </BasePaneTransition>
</template>
