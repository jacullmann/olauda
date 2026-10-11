<script setup lang="ts">
import { useAppShortcuts } from '@/shell/composables/useAppShortcuts';
import { provideHeaderOverlay } from '@/shell/composables/useHeaderOverlay';
import AppHeader from '@/shell/components/AppHeader.vue';
import AppSidebar from '@/shell/components/AppSidebar.vue';
import AppTabBar from '@/shell/components/AppTabBar.vue';
import AnnouncementBanner from '@/modules/announcements/components/AnnouncementBanner.vue';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { storeToRefs } from 'pinia';
import { useIsSidebarViewport } from '@/common/composables/useViewport';
import { useElementBounding } from '@vueuse/core';
import { computed, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const { t } = useI18n();
const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const hasSidebar = useIsSidebarViewport();

useAppShortcuts();

const headerTitle = computed(() =>
  route.meta.headerTitle ? t(route.meta.headerTitle) : undefined,
);
const headerOverlay = provideHeaderOverlay();

const header = useTemplateRef('header');
const topBarSlot = useTemplateRef('topBarSlot');
const { left: topBarLeft, width: topBarWidth } = useElementBounding(
  topBarSlot,
  { windowScroll: false },
);
const topBarStyle = computed(() => ({
  left: `${topBarLeft.value}px`,
  width: `${topBarWidth.value}px`,
}));
</script>

<template>
  <div class="flex min-h-dvh w-full">
    <AppSidebar v-if="user && hasSidebar" />

    <div class="flex-1 min-w-0 flex flex-col bg-canvas">
      <!-- Fixed rather than sticky: while Safari rubber-bands past the end of
           the page, WebKit detaches the backing store of any composited layer
           it deems off-screen, which makes a sticky header vanish outright.
           Only fixed layers are exempt. The slot keeps the bar's place in the
           flow and follows the sidebar's width. -->
      <div
        class="fixed top-0 z-(--z-header) flex flex-col"
        :style="topBarStyle"
      >
        <AppHeader ref="header" :title="headerTitle" :overlay="headerOverlay" />
        <AnnouncementBanner
          v-if="user"
          :collapse-target="header?.groupButton ?? null"
        />
      </div>
      <div ref="topBarSlot" class="shrink-0 h-(--header-height)"></div>

      <!-- A flex column all the way down, so a page can grow to fill the
           viewport below the header without ever adding scroll. -->
      <main
        class="relative flex flex-1 flex-col overflow-x-clip pb-(--tab-bar-height)"
      >
        <div
          key="content"
          :class="{
            'max-w-225 mx-auto p-0 bg-canvas': !$route.meta.fullWidth,
          }"
          class="flex w-full flex-1 flex-col"
        >
          <router-view v-slot="{ Component }">
            <!-- One page instance per group: group pages read their id once. -->
            <component
              :is="Component"
              :key="$route.params.groupId || 'default'"
            />
          </router-view>
        </div>
      </main>
    </div>

    <AppTabBar v-if="user" />
  </div>
</template>
