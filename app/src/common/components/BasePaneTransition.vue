<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  /** Changing it pushes the new pane on, or pops back to it. */
  paneKey: string;
  direction: 'forward' | 'backward';
}>();

// The pane on top slides across the full width, the one beneath only shifts
// and dims, like a phone's navigation stack.
const classes = computed(() =>
  props.direction === 'forward'
    ? {
        enterActive: 'z-2',
        enterFrom: 'motion-safe:translate-x-full',
        leaveActive: 'z-1',
        leaveTo: 'motion-safe:-translate-x-[15%] motion-safe:opacity-60',
      }
    : {
        enterActive: 'z-1',
        enterFrom: 'motion-safe:-translate-x-[15%] motion-safe:opacity-60',
        leaveActive: 'z-2',
        leaveTo: 'motion-safe:translate-x-full',
      },
);

const motion =
  'motion-safe:transition-[translate,opacity] duration-(--duration-page-push) ease-(--ease-settle)';

// Panes scroll with the page, so content passes beneath the header. The next
// one opens at the top, so the leaving one is shifted up by as far as it was
// scrolled, to stay where it was on screen.
function pinLeavingPane(el: Element) {
  (el as HTMLElement).style.top = `${-window.scrollY}px`;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}
</script>

<template>
  <div class="relative flex flex-1 flex-col">
    <Transition
      :enter-active-class="`${classes.enterActive} ${motion}`"
      :enter-from-class="classes.enterFrom"
      :leave-active-class="`absolute inset-x-0 ${classes.leaveActive} ${motion}`"
      :leave-to-class="classes.leaveTo"
      @before-leave="pinLeavingPane"
      @enter="scrollToTop"
    >
      <div :key="paneKey" class="flex flex-1 flex-col bg-canvas">
        <slot />
      </div>
    </Transition>
  </div>
</template>
