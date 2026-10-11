<script lang="ts">
import type { InjectionKey } from 'vue';

/** Scrolls a page in AppSimpleLayout back to its top, whichever element scrolls it. */
export const SCROLL_LAYOUT_TO_TOP: InjectionKey<() => void> =
  Symbol('scrollLayoutToTop');
</script>

<script setup lang="ts">
import AppLogo from '@/shell/components/AppLogo.vue';
import { computed, provide, useTemplateRef } from 'vue';
import { useScroll } from '@vueuse/core';
import { PAGE_SECONDARY_ACTIONS_ID } from '@/common/components/BasePageActions.vue';

const scroller = useTemplateRef('scroller');
const { y: scrollY } = useScroll(scroller);
const isScrolled = computed(() => scrollY.value > 0);

provide(SCROLL_LAYOUT_TO_TOP, () => {
  scroller.value?.scrollTo({ top: 0, behavior: 'instant' });
  window.scrollTo({ top: 0, behavior: 'instant' });
});
</script>

<template>
  <div
    class="flex w-full flex-col bg-canvas [--simple-header-height:calc(var(--spacing)*12)] max-md:h-dvh md:min-h-screen"
  >
    <!-- On phones the page scrolls inside the layout instead of the document,
         so its edge cuts content off above a page's secondary actions, which
         BasePageActions moves out below it. It must not rubber-band: WebKit
         still bounces a scroller that only contains its overscroll, which
         carried the main action, stuck inside it, away from the secondary
         actions left behind outside. -->
    <div
      ref="scroller"
      class="flex flex-1 flex-col max-md:min-h-0 max-md:overflow-x-hidden max-md:overflow-y-auto max-md:overscroll-none"
    >
      <header
        class="relative z-10 h-(--simple-header-height) w-full px-6 py-2 max-md:sticky max-md:top-0"
        :class="{ 'bg-canvas': !isScrolled }"
      >
        <!-- Only shown once scrolled, with the header opaque until then, like
             AppHeader's. -->
        <BaseScrollFade v-show="isScrolled" class="inset-0 -bottom-4" />
        <div class="flex items-center justify-center gap-3 text-2xl font-bold">
          <AppLogo class="shrink-0" aria-hidden="true" />
          Olauda
          <!-- TODO: implement theme and language switch -->
        </div>
      </header>
      <main
        class="flex flex-1 justify-center items-center p-6 main-content box-border"
      >
        <router-view />
      </main>
    </div>
    <div
      :id="PAGE_SECONDARY_ACTIONS_ID"
      class="md:hidden px-6 pb-[max(--spacing(6),env(safe-area-inset-bottom))] empty:hidden"
    ></div>
  </div>
</template>
