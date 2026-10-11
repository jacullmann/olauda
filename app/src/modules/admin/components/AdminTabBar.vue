<script setup lang="ts">
import { ref } from 'vue';
import type { NavItem } from '@/common/components/BaseTabs.vue';
import { useIsOnScreenKeyboardOpen } from '@/common/composables/useViewport';
import { useTabBarHeight } from '@/shell/composables/useTabBarHeight';

defineProps<{
  label: string;
  items: NavItem[];
  activeId: string;
}>();

const emit = defineEmits<{
  (e: 'change', id: string): void;
}>();

const isKeyboardOpen = useIsOnScreenKeyboardOpen();

const barEl = ref<HTMLElement | null>(null);
useTabBarHeight(barEl);
</script>

<template>
  <!-- Mirrors AppTabBar: see there for the safe-area and transition choices. -->
  <Transition
    appear
    enter-active-class="transition-[translate,scale] duration-600 ease-(--ease-spring)"
    leave-active-class="transition-[translate,scale] duration-250 ease-[cubic-bezier(0.5,0,1,1)]"
    enter-from-class="translate-y-full scale-90"
    leave-to-class="translate-y-full scale-90"
  >
    <nav
      v-show="!isKeyboardOpen"
      ref="barEl"
      :aria-label="label"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-tab-bar) flex origin-bottom justify-center pt-2 pr-(--tab-bar-inset-right) pb-[max(--spacing(2),min(var(--tab-bar-margin),env(safe-area-inset-bottom)))] pl-(--tab-bar-inset-left) lg:hidden print:hidden"
    >
      <BaseTabs
        class="pointer-events-auto max-w-md min-w-[min(var(--tabs-natural-width,0px),100%+2*var(--tab-bar-reach))]"
        variant="tab-bar"
        :items="items"
        :active-id="activeId"
        @change="emit('change', $event)"
      />
    </nav>
  </Transition>
</template>
