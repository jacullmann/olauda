<script setup lang="ts">
import { markRaw, computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import {
  CalendarDays,
  Home,
  Contrast,
  Cog,
  ListTodo,
  Shield,
  UserRound,
} from '@lucide/vue';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useDeleteAccountModal } from '@/modules/account/stores/useDeleteAccountModal';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useReturnRoute } from '@/common/composables/useReturnRoute';
import { useHeaderOverlay } from '@/shell/composables/useHeaderOverlay';
import type { NavListItem } from '@/common/types';
import AccountSettingsSecurity from '@/modules/account/components/AccountSettingsSecurity.vue';
import AccountSettingsAccount from '@/modules/account/components/AccountSettingsAccount.vue';
import AccountSettingsDashboard from '@/modules/account/components/AccountSettingsDashboard.vue';
import AccountSettingsGeneral from '@/modules/account/components/AccountSettingsGeneral.vue';
import AccountSettingsAppearance from '@/modules/account/components/AccountSettingsAppearance.vue';
import AccountSettingsTasks from '@/modules/account/components/AccountSettingsTasks.vue';
import AccountSettingsSchedule from '@/modules/account/components/AccountSettingsSchedule.vue';
import AccountSettingsProfile from '@/modules/account/components/AccountSettingsProfile.vue';
import AppLegalLinks from '@/shell/components/AppLegalLinks.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { user } = storeToRefs(useUserStore());
const deleteAccountModal = useDeleteAccountModal();
const { homeRoute } = useGroups();
// Returning to a settings page would bounce between the two pages' back buttons.
const { leave: leaveSettings } = useReturnRoute(homeRoute, [
  'account-settings',
  'group-admin',
]);

const navItems = computed<NavListItem[]>(() => [
  {
    id: 'general',
    label: t('auth.account_settings.general.title'),
    icon: markRaw(Cog),
  },
  {
    id: 'appearance',
    label: t('auth.account_settings.appearance.title'),
    icon: markRaw(Contrast),
  },
  {
    id: 'dashboard',
    label: t('auth.account_settings.dashboard.title'),
    icon: markRaw(Home),
  },
  {
    id: 'tasks',
    label: t('auth.account_settings.tasks.title'),
    icon: markRaw(ListTodo),
  },
  {
    id: 'schedule',
    label: t('auth.account_settings.schedule.title'),
    icon: markRaw(CalendarDays),
  },
  {
    id: 'security',
    label: t('auth.account_settings.security.title'),
    icon: markRaw(Shield),
  },
  {
    id: 'account',
    label: t('auth.account_settings.account.title'),
    icon: markRaw(UserRound),
  },
]);

const activeTab = computed<string>({
  get() {
    return (route.params.tab as string) || '';
  },
  set(val) {
    void router.push({
      name: 'account-settings',
      params: val ? { tab: val } : {},
    });
  },
});

const securitySubTabLabels = computed<Record<string, string>>(() => ({
  password: t('auth.security.password'),
  passkeys: t('auth.passkeys.title'),
  'two-factor': t('auth.security.2fa'),
  'connected-accounts': t('auth.account_settings.connected_accounts.title'),
  sessions: t('auth.sessions.title'),
}));

const activeTabLabel = computed(() => {
  const subTab = route.params.subTab as string | undefined;
  if (activeTab.value === 'security' && subTab) {
    return securitySubTabLabels.value[subTab] ?? '';
  }
  return navItems.value.find((n) => n.id === activeTab.value)?.label ?? '';
});

const transitionDirection = ref<'forward' | 'backward'>('forward');

const paneKey = computed(() =>
  activeTab.value
    ? [activeTab.value, route.params.subTab].filter(Boolean).join('-')
    : 'master',
);

watch(
  () => ({
    tab: route.params.tab as string | undefined,
    subTab: route.params.subTab as string | undefined,
  }),
  (newVal, oldVal) => {
    const [next, prev] =
      newVal.tab !== oldVal.tab
        ? [newVal.tab, oldVal.tab]
        : [newVal.subTab, oldVal.subTab];
    if (next && !prev) {
      transitionDirection.value = 'forward';
    } else if (!next && prev) {
      transitionDirection.value = 'backward';
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
      name: 'account-settings',
      params: { tab: activeTab.value },
    });
  } else {
    activeTab.value = '';
  }
}

useHeaderOverlay(() =>
  activeTab.value
    ? { title: activeTabLabel.value, back: goBack }
    : { title: t('auth.account_settings.title'), back: leaveSettings },
);
</script>

<template>
  <BasePaneTransition :pane-key="paneKey" :direction="transitionDirection">
    <template v-if="!activeTab">
      <div class="flex-1 py-4 md:p-4">
        <div class="flex flex-col max-w-200 mx-auto">
          <AccountSettingsProfile class="px-6 md:px-3.5 pb-6" />

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

          <AppLegalLinks class="mt-8 mb-4" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="flex-1 p-6 pt-4 md:py-8">
        <div class="w-full max-w-250 mx-auto">
          <AccountSettingsSecurity v-if="activeTab === 'security'" />

          <AccountSettingsAccount
            v-else-if="activeTab === 'account'"
            :email="user?.email ?? ''"
            @delete-account="deleteAccountModal.open()"
          />

          <AccountSettingsGeneral v-else-if="activeTab === 'general'" />

          <AccountSettingsAppearance v-else-if="activeTab === 'appearance'" />

          <AccountSettingsDashboard v-else-if="activeTab === 'dashboard'" />

          <AccountSettingsTasks v-else-if="activeTab === 'tasks'" />

          <AccountSettingsSchedule v-else-if="activeTab === 'schedule'" />
        </div>
      </div>
    </template>
  </BasePaneTransition>
</template>
