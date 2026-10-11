<script setup lang="ts">
import AppLogo from './AppLogo.vue';
import { ref, computed, onMounted } from 'vue';
import { onClickOutside, useWindowScroll } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  LogOut,
  UserRoundPlus,
  Settings,
  ArrowLeftRight,
  Search,
  Megaphone,
} from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useAnnouncementListModal } from '@/modules/announcements/stores/useAnnouncementListModal';
import { useCreateGroupModal } from '@/modules/groups/stores/useCreateGroupModal';
import { useSearchModal } from '@/modules/search/stores/useSearchModal';
import { useAnnouncementFeed } from '@/modules/announcements/composables/useAnnouncementFeed';
import AccountMenu from '@/modules/account/components/AccountMenu.vue';
import { useLogout } from '@/modules/auth/composables/useLogout';
import type { HeaderOverlay } from '@/shell/composables/useHeaderOverlay';
import {
  useIsMobileViewport,
  useIsSidebarViewport,
} from '@/common/composables/useViewport';
import { useGroupMenuActions } from '@/modules/groups/composables/useGroupMenuActions';

defineProps<{
  /** Shown in place of the group's name, or of the brand outside a group. */
  title?: string;
  /** Replaces the whole row, account menu included. */
  overlay?: HeaderOverlay;
}>();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const { t } = useI18n();
const performLogout = useLogout();
const isMobile = useIsMobileViewport();
const hasSidebar = useIsSidebarViewport();
const searchModal = useSearchModal();
const { y: scrollY } = useWindowScroll();
const isScrolled = computed(() => scrollY.value > 0);

const {
  groupName,
  activeGroupId,
  activeGroupAvatarUrl,
  activeGroupOwnerId,
  checkPermission,
} = useGroups();
const router = useRouter();

const createGroupModal = useCreateGroupModal();
const announcementsModal = useAnnouncementListModal();
const { groupAnnouncements } = useAnnouncementFeed();

// The search takes over the row on phones (SearchHeaderOverlay): its bar
// replaces the group and its cancel button the account button.
const isSearching = computed(() => isMobile.value && searchModal.isOpen);

// Timed against the search backdrop's blur: gone while it is still faint on
// the way in, and back only once it has nearly cleared on the way out.
// Returning under strong blur, they would bloom into a bright smudge. Not a
// time-reversed exit, though: that would accelerate into place and land with a
// thud, so they return easing out, settling after the backdrop is gone.
const searchHandoverTiming = computed(() =>
  isSearching.value
    ? 'duration-200 ease-out'
    : 'duration-250 delay-200 ease-[cubic-bezier(0.33,1,0.68,1)]',
);
const searchHandoverClasses = computed(() => [
  searchHandoverTiming.value,
  { 'opacity-0 pointer-events-none': isSearching.value },
]);

function onPersonalizationChanged(value: boolean) {
  userStore.updateUser({ personalized: value });
}

const groupMenuOpen = ref(false);
const groupMenuRef = ref<HTMLElement | null>(null);
const groupButtonRef = ref<HTMLElement | null>(null);

function toggleGroupMenu() {
  groupMenuOpen.value = !groupMenuOpen.value;
}

function openGroupsPage() {
  groupMenuOpen.value = false;
  void router.push({ name: 'groups' });
}

onClickOutside(groupMenuRef, () => {
  groupMenuOpen.value = false;
});

const { pending, inviteMember, openGroupSettings, leaveGroup } =
  useGroupMenuActions();

function leaveActiveGroup() {
  if (!activeGroupId.value || !groupName.value) return;
  void leaveGroup({
    id: activeGroupId.value,
    name: groupName.value,
    ownerId: activeGroupOwnerId.value,
  });
}

function openActiveGroupSettings() {
  groupMenuOpen.value = false;
  if (activeGroupId.value) openGroupSettings(activeGroupId.value);
}

function inviteToActiveGroup() {
  groupMenuOpen.value = false;
  if (activeGroupId.value) void inviteMember(activeGroupId.value);
}

function openAnnouncements() {
  groupMenuOpen.value = false;
  announcementsModal.show();
}

onMounted(() => {
  if (!userStore.initialized) {
    void userStore.fetchUser();
  }
});

defineExpose({ groupButton: groupButtonRef });
</script>

<template>
  <header
    class="relative flex w-full justify-center items-center overflow-x-clip text-on-ghost font-display p-0 h-(--header-height) z-(--z-header)"
    :class="{ 'bg-canvas': !isScrolled }"
  >
    <!-- Stays within the header, so it never covers the announcement bar
         docked below. The x-clip trims the fade's sideways bleed, which would
         otherwise paint over the sidebar's border and widen the page. Only
         shown once scrolled, sparing the backdrop filters when there is
         nothing underneath.
         Until then the header is opaque instead: Safari 26 colors the status
         bar from what a fixed header paints along its top edge, and where it
         finds nothing it lays its own blurred scroll edge effect over the
         header. It also stops sampling once the user interacts, so a
         transparent header at load could keep that blur. -->
    <BaseScrollFade v-show="isScrolled" class="inset-0 -bottom-4" />

    <div class="relative h-full w-full flex items-center gap-2 px-4 max-w-325">
      <div
        v-if="overlay"
        class="flex items-center gap-2 min-w-0 transition-opacity"
        :class="searchHandoverClasses"
      >
        <BaseButton
          variant="ghost"
          on="ghost"
          :aria-label="t('common.buttons.back')"
          :icon="ChevronLeft"
          @click="overlay.back"
        />
        <span class="logo-text leading-8 truncate">{{ overlay.title }}</span>
      </div>
      <div
        v-else-if="activeGroupId && groupName"
        ref="groupMenuRef"
        class="relative flex items-center min-w-0 max-w-full transition-opacity"
        :class="searchHandoverClasses"
      >
        <button
          ref="groupButtonRef"
          v-wave
          class="relative flex items-center gap-3 cursor-pointer hover:bg-ghost-hover active:bg-ghost-hover transition-hover rounded-full p-1 min-w-0 touch-target after:min-w-12 after:min-h-12"
          @click="toggleGroupMenu"
        >
          <BaseAvatar
            :name="groupName"
            :picture="activeGroupAvatarUrl"
            :size="8"
            class="shrink-0"
          />

          <span class="logo-text leading-8 truncate min-w-0">
            {{ title ?? groupName }}
            <span v-if="title" class="sr-only">{{ groupName }}</span>
          </span>
          <ChevronDown
            :size="16"
            class="text-on-ghost-muted mr-2 shrink-0 transition-transform duration-200 ease-in-out"
            :class="{ 'rotate-180': groupMenuOpen }"
          />
        </button>

        <BaseMenu
          :open="groupMenuOpen"
          :title="groupName"
          class="top-full mt-1 left-0"
          @close="groupMenuOpen = false"
        >
          <BaseMenuButton
            :icon="Plus"
            @click="
              groupMenuOpen = false;
              createGroupModal.open();
            "
          >
            {{ t('common.sidebar.create') }}
          </BaseMenuButton>

          <BaseMenuButton :icon="ArrowLeftRight" @click="openGroupsPage">
            {{ t('common.header.switch_group') }}
          </BaseMenuButton>

          <BaseMenuDivider />

          <BaseMenuButton
            v-if="checkPermission('invite_members')"
            :icon="UserRoundPlus"
            :disabled="pending"
            @click="inviteToActiveGroup"
          >
            {{ t('auth.groups.invite.invite_button_header') }}
          </BaseMenuButton>

          <BaseMenuButton
            v-if="
              groupAnnouncements.length ||
              checkPermission('manage_announcements')
            "
            :icon="Megaphone"
            @click="openAnnouncements"
          >
            {{ t('announcements.list.title') }}
          </BaseMenuButton>

          <BaseMenuButton :icon="Settings" @click="openActiveGroupSettings">
            {{ t('common.sidebar.admin') }}
          </BaseMenuButton>

          <BaseMenuDivider />

          <BaseMenuButton
            :icon="LogOut"
            danger
            :disabled="pending"
            @click="leaveActiveGroup"
          >
            {{ t('common.header.leave_group') }}
          </BaseMenuButton>
        </BaseMenu>
      </div>
      <div
        v-else-if="title"
        class="flex leading-8 gap-3 px-1 min-w-0 transition-opacity"
        :class="searchHandoverClasses"
      >
        <router-link :to="{ name: 'groups' }">
          <AppLogo aria-hidden="true" />
        </router-link>
        <span class="logo-text leading-8 truncate">{{ title }}</span>
      </div>
      <router-link
        v-else
        :to="{ name: 'groups' }"
        class="flex leading-8 gap-3 px-1 min-w-0 transition-opacity"
        :class="searchHandoverClasses"
      >
        <AppLogo aria-hidden="true" />
        <span class="logo-text truncate">Olauda</span>
      </router-link>

      <div
        v-if="user && !hasSidebar && !overlay"
        class="ml-auto flex items-center gap-2 shrink-0"
      >
        <!-- Hidden without a fade: the search bar carries its icon away from
             here and brings it back once closed. -->
        <BaseButton
          variant="ghost"
          on="ghost"
          :aria-label="t('common.sidebar.search')"
          :icon="Search"
          :class="{ 'opacity-0': searchModal.isVisible }"
          @click="searchModal.open()"
        />

        <AccountMenu
          :email="user.email"
          :user-data="user"
          icon-only
          tooltip-placement="left"
          class="transition-[opacity,scale,filter]"
          :class="[
            searchHandoverTiming,
            { 'opacity-0 scale-50 blur-xs pointer-events-none': isSearching },
          ]"
          @logout="performLogout"
          @personalization-changed="onPersonalizationChanged"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.logo-text {
  font-size: var(--text-2xl);
  font-weight: 700;
  transition: opacity 0.2s ease;
}

@media (max-width: 384px) {
  .logo-text {
    font-size: var(--text-xl);
  }
}
@media (max-width: 352px) {
  .logo-text {
    font-size: var(--text-lg);
  }
}
@media (max-width: 320px) {
  .logo-text {
    font-size: var(--text-base);
  }
}
</style>
