<script setup lang="ts">
import { computed, onMounted, markRaw, ref, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { BookUser, Flag, Home, Info, ScrollText } from '@lucide/vue';
import AdminFrame from '@/modules/admin/components/AdminFrame.vue';
import AdminTabBar from '@/modules/admin/components/AdminTabBar.vue';
import { useAdminStats } from '@/modules/admin/composables/useAdminStats';
import type { AdminNavItem } from '@/modules/admin/types';

const route = useRoute();
const router = useRouter();
const { stats, loadStats } = useAdminStats();
const { t } = useI18n();

const navItems = computed<(AdminNavItem & { icon: Component })[]>(() => [
  {
    id: 'overview',
    name: 'super-admin',
    label: t('admin.nav.overview'),
    icon: markRaw(Home),
    count: 0,
  },
  {
    id: 'directory',
    name: 'admin-users',
    label: t('admin.nav.directory'),
    icon: markRaw(BookUser),
    count: 0,
  },
  {
    id: 'log',
    name: 'admin-log',
    label: t('admin.nav.log'),
    icon: markRaw(ScrollText),
    count: 0,
  },
  {
    id: 'announcements',
    name: 'admin-announcements',
    label: t('admin.nav.announcements'),
    icon: markRaw(Info),
    count: 0,
  },
  {
    id: 'reports',
    name: 'admin-reports',
    label: t('admin.nav.reports'),
    icon: markRaw(Flag),
    count: stats.value?.reportCount ?? 0,
    danger: true,
  },
]);

/** The tab being navigated to, shown as selected until the navigation settles. */
const pendingTab = ref<string | null>(null);

const routeTab = computed(() => route.meta.adminTab ?? 'overview');
const activeTab = computed(() => pendingTab.value ?? routeTab.value);

async function onTabChange(id: string) {
  const item = navItems.value.find((i) => i.id === id);
  if (!item) return;
  const isSwitchingTab = routeTab.value !== id;
  pendingTab.value = id;
  try {
    const failure = await router.push({ name: item.name });
    if (!failure && isSwitchingTab) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  } finally {
    // A blocked or failed navigation hands the selection back to the route,
    // unless a later tap has already claimed it.
    if (pendingTab.value === id) pendingTab.value = null;
  }
}

// The only place the stats are fetched on entry; child pages share the result.
onMounted(loadStats);
</script>

<template>
  <AdminFrame
    :nav-items="navItems"
    :active-tab="activeTab"
    @update:active-tab="onTabChange"
  >
    <router-view v-slot="{ Component: page }">
      <!-- A list keeps its place behind a page opened from it, such as an
           account opened from the log, while the admin area stays open. -->
      <KeepAlive :include="['AdminDirectoryLayout', 'AdminLogPage']">
        <component :is="page" />
      </KeepAlive>
    </router-view>
    <AdminTabBar
      :label="t('navigation.super_admin')"
      :items="navItems"
      :active-id="activeTab"
      @change="onTabChange"
    />
  </AdminFrame>
</template>
