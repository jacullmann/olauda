<script lang="ts">
/** Where AppSimpleLayout takes a page's secondary actions on phones. */
export const PAGE_SECONDARY_ACTIONS_ID = 'page-secondary-actions';
</script>

<script setup lang="ts">
import { useAttrs } from 'vue';
import { useIsMobileViewport } from '@/common/composables/useViewport';

/*
 * The actions of a page that is a form of its own. On phones the main action
 * stays pinned to the bottom of the page's scroller, over the content blurring
 * out behind it. The transparent secondary actions move out below the
 * scroller, whose edge cuts the content off, so nothing ever shows behind
 * them. The negative margin takes over the layout's bottom padding, so the
 * main action sits in the same place at rest and while stuck.
 */
defineOptions({ inheritAttrs: false });

defineSlots<{
  default(): unknown;
  secondary?(): unknown;
}>();

const attrs = useAttrs();
const isMobile = useIsMobileViewport();
</script>

<template>
  <div
    v-bind="attrs"
    class="relative z-10 flex flex-col gap-2 w-full max-md:sticky max-md:bottom-0 max-md:-mb-6 max-md:pt-6 max-md:pb-2"
  >
    <!-- Spans the screen however wide the gutters; flipped, so the content
         fades out towards the scroller's edge. The flip turns its bleed
         downwards, so it stops short by that much to end on the scroller's
         edge instead of overflowing it, which left the page a few pixels to
         scroll. -->
    <BaseScrollFade
      class="hidden max-md:block inset-x-[calc(50%-50vw)] -top-4 bottom-(--scroll-fade-bleed) -scale-y-100"
    />
    <slot></slot>

    <Teleport
      v-if="$slots.secondary"
      :to="`#${PAGE_SECONDARY_ACTIONS_ID}`"
      :disabled="!isMobile"
      defer
    >
      <!-- Carries the page's width and entrance along once moved out, but not
           its spacing, which only concerns the actions as a whole. -->
      <div
        class="flex flex-col gap-2 w-full mt-0!"
        v-bind="isMobile ? attrs : {}"
      >
        <slot name="secondary"></slot>
      </div>
    </Teleport>
  </div>
</template>
