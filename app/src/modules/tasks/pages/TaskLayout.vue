<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { provideTasks } from '@/modules/tasks/composables/useTasks';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import TaskDialogs from '@/modules/tasks/components/TaskDialogs.vue';

provideTasks();

const route = useRoute();
const isMobile = useIsMobileViewport();

// Like a page pushed onto a phone's navigation stack, an opened task slides in
// over the list. Stepping back swaps them at once: the list is still there.
const slidesIn = computed(() => isMobile.value && route.name === 'group-task');
const isSliding = ref(false);

function startSlide() {
  if (slidesIn.value) isSliding.value = true;
}

function endSlide() {
  isSliding.value = false;
}

// The task opens scrolled to the top, so the list sliding out beneath it is
// shifted up by as far as it was scrolled, to stay where it was on screen.
function pinLeavingList(el: Element) {
  if (slidesIn.value) (el as HTMLElement).style.top = `${-window.scrollY}px`;
}

// The list is kept alive, so it returns with whatever it left with.
function unpinList(el: Element) {
  (el as HTMLElement).style.top = '';
}
</script>

<template>
  <!-- Clipped while the task slides in, so it does not widen the page from
       beyond its edge. -->
  <div
    class="relative flex flex-1 flex-col"
    :class="{ 'overflow-clip': isSliding }"
  >
    <RouterView v-slot="{ Component }">
      <!-- The list stays alive behind an opened task, so closing the task
           returns to it as it was left instead of loading it again. -->
      <Transition
        :css="slidesIn"
        enter-active-class="z-(--z-base) bg-canvas motion-safe:transition-[translate] duration-(--duration-page-push) ease-(--ease-settle)"
        enter-from-class="motion-safe:translate-x-full"
        leave-active-class="absolute inset-x-0 motion-safe:transition-opacity duration-(--duration-page-push) ease-(--ease-settle)"
        leave-to-class="motion-safe:opacity-60"
        @before-enter="startSlide"
        @after-enter="endSlide"
        @enter-cancelled="endSlide"
        @before-leave="pinLeavingList"
        @after-leave="unpinList"
        @leave-cancelled="unpinList"
      >
        <KeepAlive include="TaskListPage">
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </div>

  <TaskDialogs />
</template>
