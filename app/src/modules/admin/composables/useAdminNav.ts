import { computed, markRaw, ref, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { BookUser, Flag, Home, Info, ScrollText } from '@lucide/vue';
import type { AdminNavItem, AdminTab } from '@/modules/admin/types';

export type AdminNavEntry = AdminNavItem & { icon: Component };

/** The superadmin tabs, shown in the app sidebar on wide screens and in the
 * admin tab bar below them. */
export function useAdminNav() {
  const route = useRoute();
  const router = useRouter();
  const { t } = useI18n();

  const navItems = computed<AdminNavEntry[]>(() => [
    {
      id: 'overview',
      name: 'super-admin',
      label: t('admin.nav.overview'),
      icon: markRaw(Home),
    },
    {
      id: 'directory',
      name: 'admin-users',
      label: t('admin.nav.directory'),
      icon: markRaw(BookUser),
    },
    {
      id: 'log',
      name: 'admin-log',
      label: t('admin.nav.log'),
      icon: markRaw(ScrollText),
    },
    {
      id: 'announcements',
      name: 'admin-announcements',
      label: t('admin.nav.announcements'),
      icon: markRaw(Info),
    },
    {
      id: 'reports',
      name: 'admin-reports',
      label: t('admin.nav.reports'),
      icon: markRaw(Flag),
    },
  ]);

  /** The tab being navigated to, shown as selected until the navigation settles. */
  const pendingTab = ref<AdminTab | null>(null);

  const routeTab = computed(() => route.meta.adminTab ?? null);
  const activeTab = computed(() => pendingTab.value ?? routeTab.value);

  async function selectTab(id: string) {
    const item = navItems.value.find((i) => i.id === id);
    if (!item) return;
    const isSwitchingTab = routeTab.value !== item.id;
    pendingTab.value = item.id;
    try {
      const failure = await router.push({ name: item.name });
      if (!failure && isSwitchingTab) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } finally {
      // A blocked or failed navigation hands the selection back to the route,
      // unless a later tap has already claimed it.
      if (pendingTab.value === item.id) pendingTab.value = null;
    }
  }

  return { navItems, activeTab, selectTab };
}
