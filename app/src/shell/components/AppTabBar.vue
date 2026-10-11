<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { House, ListTodo, CalendarDays, Lock } from '@lucide/vue';
import type { NavItem } from '@/common/components/BaseTabs.vue';
import { useIsOnScreenKeyboardOpen } from '@/common/composables/useViewport';
import { useGroupAction } from '@/modules/groups/composables/useGroupAction';
import { useTabBarHeight } from '@/shell/composables/useTabBarHeight';

const PRIVATE_TAB = 'private-todos';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const isKeyboardOpen = useIsOnScreenKeyboardOpen();
const { withGroup } = useGroupAction();

/** Each tab's id is the name of the route it opens. */
const tabs = computed<NavItem[]>(() => [
  { id: 'group-dashboard', label: t('common.sidebar.dashboard'), icon: House },
  { id: 'group-tasks', label: t('common.sidebar.tasks'), icon: ListTodo },
  {
    id: 'group-schedule',
    label: t('common.tab_bar.schedule'),
    icon: CalendarDays,
  },
  {
    id: PRIVATE_TAB,
    label: t('common.tab_bar.private'),
    icon: Lock,
  },
]);

/** The tab being navigated to, shown as selected until the navigation settles. */
const pendingTab = ref<string | null>(null);

const routeTab = computed(() => {
  const current = route.meta.navItem ?? route.name;
  return tabs.value.find((tab) => tab.id === current)?.id ?? null;
});
const activeTab = computed(() => pendingTab.value ?? routeTab.value);

async function openTab(name: string, location: RouteLocationRaw) {
  const isSwitchingTab = routeTab.value !== name;
  pendingTab.value = name;
  try {
    const failure = await router.push(location);
    // Another tab opens at its top, like a native tab bar. Tapping the current
    // tab, e.g. from an opened task, leaves the page to restore its own place.
    if (!failure && isSwitchingTab) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  } finally {
    // A blocked or failed navigation hands the selection back to the route,
    // unless a later tap has already claimed it.
    if (pendingTab.value === name) pendingTab.value = null;
  }
}

function selectTab(name: string) {
  if (name === PRIVATE_TAB) {
    void openTab(name, { name });
    return;
  }
  // The private page has no :groupId to inherit, so group tabs pass it explicitly.
  withGroup((groupId) => void openTab(name, { name, params: { groupId } }));
}

const barEl = ref<HTMLElement | null>(null);
useTabBarHeight(barEl);
</script>

<template>
  <!-- The nav spans the full width for the safe-area math, but only the bar
       itself takes pointer events, so the margin around it stays tappable.
       Like a native tab bar, it reaches into the bottom safe area: that space
       only keeps the home indicator clear, which the margin already does.
       Too narrow for its tabs' full padding, the bar reaches into the side
       margins instead, overflowing the nav evenly, before it crams them.
       It slides off the bottom edge the same way. Only transforms move:
       opacity or a filter here would make the nav a backdrop root, and the
       glass would lose the page behind it until the transition ended. -->
  <Transition
    enter-active-class="transition-[translate,scale] duration-600 ease-(--ease-spring)"
    leave-active-class="transition-[translate,scale] duration-250 ease-[cubic-bezier(0.5,0,1,1)]"
    enter-from-class="translate-y-full scale-90"
    leave-to-class="translate-y-full scale-90"
  >
    <nav
      v-if="routeTab"
      v-show="!isKeyboardOpen"
      ref="barEl"
      :aria-label="t('common.tab_bar.label')"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-tab-bar) flex origin-bottom justify-center pt-2 pr-(--tab-bar-inset-right) pb-[max(--spacing(2),min(var(--tab-bar-margin),env(safe-area-inset-bottom)))] pl-(--tab-bar-inset-left) lg:hidden print:hidden"
    >
      <BaseTabs
        class="pointer-events-auto max-w-md min-w-[min(var(--tabs-natural-width,0px),100%+2*var(--tab-bar-reach))]"
        variant="tab-bar"
        :items="tabs"
        :active-id="activeTab ?? ''"
        @change="selectTab"
      />
    </nav>
  </Transition>
</template>
