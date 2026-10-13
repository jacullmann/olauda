<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  type CSSProperties,
} from 'vue';

type Placement = 'top' | 'bottom' | 'left' | 'right';

const props = withDefaults(
  defineProps<{
    content?: string;
    shortcut?: string[];
    disabled?: boolean;
    debounce?: 'slow' | 'fast';
    placement?: Placement;
  }>(),
  {
    debounce: 'fast',
    placement: 'right',
  },
);

const isVisible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const tooltipStyle = ref<CSSProperties>({});

let showTimeout: ReturnType<typeof setTimeout> | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

const clearTimers = () => {
  if (showTimeout) clearTimeout(showTimeout);
  if (hideTimeout) clearTimeout(hideTimeout);
};

const updatePosition = () => {
  if (!triggerRef.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const offset = 8;
  const pos: Record<Placement, CSSProperties> = {
    top: {
      top: `${rect.top - offset}px`,
      left: `${rect.left + rect.width / 2}px`,
      '--translate-base': 'translate(-50%, -100%)',
    },
    bottom: {
      top: `${rect.bottom + offset}px`,
      left: `${rect.left + rect.width / 2}px`,
      '--translate-base': 'translateX(-50%)',
    },
    left: {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.left - offset}px`,
      '--translate-base': 'translate(-100%, -50%)',
    },
    right: {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.right + offset}px`,
      '--translate-base': 'translateY(-50%)',
    },
  };

  tooltipStyle.value = pos[props.placement];
};

const transitionClasses = computed(() => {
  const directions = {
    top: 'translate-y-1',
    bottom: '-translate-y-1',
    left: 'translate-x-1',
    right: '-translate-x-1',
  };

  return {
    enter: 'transition duration-150 ease-out',
    leave: 'transition duration-100 ease-in',
    from: `opacity-0 ${directions[props.placement]}`,
    to: 'opacity-100 translate-0',
  };
});

const show = () => {
  if (props.disabled || !props.content) return;
  clearTimers();
  const delay = props.debounce === 'slow' ? 350 : 50;

  showTimeout = setTimeout(() => {
    updatePosition();
    isVisible.value = true;
  }, delay);
};

const hide = () => {
  clearTimers();
  hideTimeout = setTimeout(() => {
    isVisible.value = false;
  }, 50);
};

const immediateHide = () => {
  clearTimers();
  isVisible.value = false;
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isVisible.value) immediateHide();
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('scroll', updatePosition);
  window.removeEventListener('resize', updatePosition);
  immediateHide();
});
</script>

<template>
  <div
    ref="triggerRef"
    class="inline-block"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @click="immediateHide"
  >
    <slot></slot>

    <Teleport to="body">
      <Transition
        :enter-active-class="transitionClasses.enter"
        :enter-from-class="transitionClasses.from"
        :enter-to-class="transitionClasses.to"
        :leave-active-class="transitionClasses.leave"
        :leave-from-class="transitionClasses.to"
        :leave-to-class="transitionClasses.from"
      >
        <div
          v-if="isVisible"
          class="fixed z-(--z-tooltip) pointer-events-none"
          :style="tooltipStyle"
        >
          <div
            class="px-2 py-1.5 bg-action text-on-action text-xs/4 font-medium rounded-md shadow-lg whitespace-nowrap"
            style="transform: var(--translate-base)"
          >
            {{ content }}
            <BaseKbdGroup
              v-if="shortcut"
              :keys="shortcut"
              on="action"
              class="ml-2"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
