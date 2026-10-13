<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useIsMobileViewport } from '@/common/composables/useViewport';

const props = defineProps<{
  /** The name of the page component kept alive beneath the pushed one. */
  rootPage: string;
  /** The name of the route that is pushed onto the root page. */
  pushedRoute: string;
}>();

const route = useRoute();
const isMobile = useIsMobileViewport();

// Like a page pushed onto a phone's navigation stack, the pushed page slides
// in over the root page, which only shifts aside beneath it. Stepping back
// swaps them at once: the root page is still there.
const slidesIn = computed(
  () => isMobile.value && route.name === props.pushedRoute,
);
const isSliding = ref(false);

function startSlide() {
  if (slidesIn.value) isSliding.value = true;
}

function endSlide() {
  isSliding.value = false;
}

// The pushed page opens scrolled to the top, so the root page sliding out
// beneath it is shifted up by as far as it was scrolled, to stay where it was
// on screen.
function pinLeavingRoot(el: Element) {
  if (slidesIn.value) (el as HTMLElement).style.top = `${-window.scrollY}px`;
}

// The root page is kept alive, so it returns with whatever it left with.
function unpinRoot(el: Element) {
  (el as HTMLElement).style.top = '';
}
</script>

<template>
  <!-- Clipped while the pushed page slides in, so it does not widen the page
       from beyond its edge. -->
  <div
    class="relative flex flex-1 flex-col"
    :class="{ 'overflow-clip': isSliding }"
  >
    <RouterView v-slot="{ Component }">
      <!-- The root page stays alive behind a pushed one, so stepping back
           returns to it as it was left instead of loading it again. -->
      <Transition
        :css="slidesIn"
        enter-active-class="z-(--z-base) bg-canvas motion-safe:transition-[translate] duration-(--duration-page-push) ease-(--ease-settle)"
        enter-from-class="motion-safe:translate-x-full"
        leave-active-class="absolute inset-x-0 motion-safe:transition-[translate] duration-(--duration-page-push) ease-(--ease-settle)"
        leave-to-class="motion-safe:translate-x-(--page-push-shift)"
        @before-enter="startSlide"
        @after-enter="endSlide"
        @enter-cancelled="endSlide"
        @before-leave="pinLeavingRoot"
        @after-leave="unpinRoot"
        @leave-cancelled="unpinRoot"
      >
        <KeepAlive :include="rootPage">
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </div>
</template>
