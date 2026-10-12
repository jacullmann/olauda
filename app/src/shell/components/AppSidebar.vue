<script setup lang="ts">
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import {
  PanelLeft,
  SquarePen,
  Megaphone,
  House,
  UsersRound,
  ListTodo,
  CalendarDays,
  Settings,
  Lock as LockIcon,
  Search,
  Plus,
  Star,
} from '@lucide/vue';
import AccountMenu from '@/modules/account/components/AccountMenu.vue';
import { useAnnouncementListModal } from '@/modules/announcements/stores/useAnnouncementListModal';
import { useCreateGroupModal } from '@/modules/groups/stores/useCreateGroupModal';
import { useSearchModal } from '@/modules/search/stores/useSearchModal';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { useAnnouncementStore } from '@/modules/announcements/stores/useAnnouncementStore';
import { useSidebarStore } from '@/shell/stores/useSidebarStore';
import { storeToRefs } from 'pinia';
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useLogout } from '@/modules/auth/composables/useLogout';
import { useRouter, type RouteLocationRaw } from 'vue-router';
import AppSidebarButton from './AppSidebarButton.vue';
import { useI18n } from 'vue-i18n';
import { useGroupAction } from '@/modules/groups/composables/useGroupAction';
import { useOpenGroup } from '@/modules/groups/composables/useOpenGroup';

const { t } = useI18n();
const performLogout = useLogout();

const userStore = useUserStore();
const { user, isSuperadmin } = storeToRefs(userStore);

const { activeGroupId, contextGroupId, userGroups, checkPermission } =
  useGroups();
const router = useRouter();

const sidebarStore = useSidebarStore();
const { expanded: isExpanded } = storeToRefs(sidebarStore);
const searchModal = useSearchModal();
const taskFormModal = useTaskFormModal();
const announcementsModal = useAnnouncementListModal();
const { announcements } = storeToRefs(useAnnouncementStore());
const createGroupModal = useCreateGroupModal();
const { withGroup } = useGroupAction();
const { openGroup } = useOpenGroup();

const showAnnouncements = computed(
  () =>
    announcements.value.length > 0 || checkPermission('manage_announcements'),
);

function toggleExpanded() {
  sidebarStore.toggle();
}

function onPersonalizationChanged(value: boolean) {
  userStore.updateUser({ personalized: value });
}

function handleNavigation(to: RouteLocationRaw) {
  void router.push(to);
}

function handleTask() {
  withGroup((groupId) => taskFormModal.openNew(groupId));
}

const sidebarScrollEl = ref<HTMLElement | null>(null);

const showTopFade = ref(false);
const showBottomFade = ref(false);

function updateFadeState(el: HTMLElement | null) {
  if (!el) {
    showTopFade.value = false;
    showBottomFade.value = false;
    return;
  }
  showTopFade.value = el.scrollTop > 1;
  showBottomFade.value = el.scrollHeight - el.scrollTop - el.clientHeight > 1;
}

let scrollTicking = false;

function handleScroll() {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      updateFadeState(sidebarScrollEl.value);
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}

const fadeMask = computed(() => {
  const top = showTopFade.value;
  const bottom = showBottomFade.value;

  if (top && bottom) {
    return 'linear-gradient(to bottom, transparent 0px, black 32px, black calc(100% - 32px), transparent 100%)';
  } else if (top) {
    return 'linear-gradient(to bottom, transparent 0px, black 32px)';
  } else if (bottom) {
    return 'linear-gradient(to top, transparent 0px, black 32px)';
  }
  return 'none';
});

let resizeObserver: ResizeObserver | null = null;

function setupObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const el = sidebarScrollEl.value;
  if (!el) {
    showTopFade.value = false;
    showBottomFade.value = false;
    return;
  }

  updateFadeState(el);

  resizeObserver = new ResizeObserver(() => {
    updateFadeState(sidebarScrollEl.value);
  });
  resizeObserver.observe(el);

  for (const child of el.children) {
    resizeObserver.observe(child);
  }
}

watch(sidebarScrollEl, () => {
  setupObserver();
});

watch(
  userGroups,
  () => {
    void nextTick(() => {
      setupObserver();
    });
  },
  { deep: true },
);

onMounted(() => {
  if (!userStore.initialized) {
    void userStore.fetchUser();
  }
  setupObserver();
});

function openGroupPage(name: string) {
  withGroup((groupId) => handleNavigation({ name, params: { groupId } }));
}

onUnmounted(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <aside
    class="sidebar sticky top-0 flex flex-col justify-between shrink-0 overflow-hidden h-dvh p-2.5 bg-surface border-r border-ghost-border z-(--z-header) sidebar-motion"
    :class="isExpanded ? 'w-64' : 'w-[61px]'"
    :data-expanded="isExpanded || undefined"
  >
    <div class="flex flex-col gap-4 w-full flex-1 min-h-0">
      <AppSidebarButton
        :label="
          isExpanded ? t('common.sidebar.collapse') : t('common.sidebar.expand')
        "
        :shortcut="['ctrl', 'shift', 'd']"
        :expanded="isExpanded"
        :icon="PanelLeft"
        :page="false"
        @click="toggleExpanded"
      />

      <div class="flex flex-col gap-0 w-full">
        <AppSidebarButton
          :label="t('common.sidebar.task')"
          :shortcut="['alt', 'n']"
          :expanded="isExpanded"
          :icon="SquarePen"
          :page="false"
          @click="handleTask"
        />

        <AppSidebarButton
          v-if="showAnnouncements"
          :label="t('announcements.list.title')"
          :expanded="isExpanded"
          :icon="Megaphone"
          :page="false"
          @click="announcementsModal.show()"
        />

        <AppSidebarButton
          :label="t('common.sidebar.search')"
          :shortcut="['ctrl', 'k']"
          :expanded="isExpanded"
          :icon="Search"
          :page="false"
          @click="searchModal.open()"
        />
      </div>

      <div class="flex flex-col gap-0 w-full">
        <AppSidebarButton
          :label="t('common.sidebar.dashboard')"
          :expanded="isExpanded"
          :active="$route.name === 'group-dashboard'"
          :icon="House"
          @click="openGroupPage('group-dashboard')"
        />

        <AppSidebarButton
          :label="t('common.sidebar.tasks')"
          :expanded="isExpanded"
          :active="$route.meta.navItem === 'group-tasks'"
          :icon="ListTodo"
          @click="openGroupPage('group-tasks')"
        />

        <AppSidebarButton
          :label="t('common.sidebar.schedule')"
          :expanded="isExpanded"
          :active="$route.name === 'group-schedule'"
          :icon="CalendarDays"
          @click="openGroupPage('group-schedule')"
        />

        <AppSidebarButton
          v-if="contextGroupId"
          :label="t('common.sidebar.admin')"
          :expanded="isExpanded"
          :active="$route.name === 'group-admin'"
          :icon="Settings"
          @click="openGroupPage('group-admin')"
        />
      </div>

      <div class="flex flex-col gap-0 w-full">
        <AppSidebarButton
          :label="t('common.sidebar.groups')"
          :expanded="isExpanded"
          :active="$route.name === 'groups'"
          :icon="UsersRound"
          @click="handleNavigation({ name: 'groups' })"
        />

        <AppSidebarButton
          :label="t('common.sidebar.private')"
          :expanded="isExpanded"
          :active="$route.name === 'private-todos'"
          :icon="LockIcon"
          @click="handleNavigation({ name: 'private-todos' })"
        />

        <AppSidebarButton
          v-if="isSuperadmin"
          :label="t('common.roles.superadmin')"
          :expanded="isExpanded"
          :active="$route.meta.navItem === 'super-admin'"
          :icon="Star"
          @click="handleNavigation({ name: 'super-admin' })"
        />
      </div>

      <div
        class="m-1 border-t border-ghost-border"
        role="separator"
        aria-orientation="horizontal"
      ></div>

      <div
        ref="sidebarScrollEl"
        class="flex flex-col gap-2 -mx-2.5 px-2.5 overflow-y-auto overflow-x-hidden flex-1 list-fade"
        :style="{ '--menu-fade-mask': fadeMask }"
        @scroll="handleScroll"
      >
        <BaseTooltip
          v-for="(group, index) in userGroups"
          :key="index"
          :content="group.name"
          placement="right"
        >
          <button
            v-wave
            :class="activeGroupId === group.id ? 'active' : ''"
            class="group relative gap-0 items-center flex p-1 text-on-ghost-muted hover:text-on-ghost rounded-full bg-transparent hover:bg-ghost-hover active:bg-ghost-hover transition-hover cursor-pointer outline-none w-full touch-target after:min-w-[calc(100%+24px)] after:min-h-12"
            @click="openGroup(group.id, 'group-tasks')"
          >
            <span
              class="absolute transition-[max-height,width,top,opacity] duration-200 -left-2.5 group-[.active]:top-0 group-hover:top-[25%] top-[45%] bottom-0 w-0.5 opacity-0 group-[.active]:w-1 group-hover:w-1 group-[.active]:opacity-100 group-hover:opacity-100 group-[.active]:max-h-full group-hover:max-h-[50%] max-h-[10%] bg-action rounded-r-full"
            ></span>
            <BaseAvatar
              :name="group.name"
              :picture="group.avatarUrl"
              :size="8"
            />
            <span
              class="sidebar-fade text-sm/5 font-medium whitespace-nowrap ml-2"
              :class="isExpanded ? 'opacity-100' : 'opacity-0'"
            >
              {{ group.name }}
            </span>
          </button>
        </BaseTooltip>

        <AppSidebarButton
          :label="t('common.sidebar.create')"
          :expanded="isExpanded"
          :icon="Plus"
          :page="false"
          @click="createGroupModal.open()"
        />
      </div>
    </div>

    <AccountMenu
      v-if="user"
      class="w-full"
      :email="user.email"
      :user-data="user"
      :expanded="isExpanded"
      @logout="performLogout"
      @personalization-changed="onPersonalizationChanged"
    />
  </aside>
</template>

<style scoped>
.list-fade {
  -webkit-mask-image: var(--menu-fade-mask, none);
  mask-image: var(--menu-fade-mask, none);
}
</style>
