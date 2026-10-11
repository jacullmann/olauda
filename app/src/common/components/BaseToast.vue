<script setup lang="ts">
import {
  ref,
  computed,
  onBeforeUnmount,
  watch,
  type ComponentPublicInstance,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useEventListener } from '@vueuse/core';
import { useToast, type Toast } from '@/common/composables/useToast';
import { useToastSwipe } from '@/common/composables/useToastSwipe';
import { Check, AlertTriangle, CircleX, Info, X } from '@lucide/vue';

const { toasts, dismiss, setIsHovered } = useToast();
const { t } = useI18n();

const ICONS = {
  success: Check,
  error: CircleX,
  warning: AlertTriangle,
  info: Info,
};

const ICON_COLORS: Record<string, string> = {
  success: 'text-on-action bg-action',
  error: 'text-on-danger bg-danger',
  warning: 'text-on-warn bg-warn',
  info: 'text-on-ghost bg-surface border border-ghost-border',
};

const VISIBLE_COUNT = 3;
const GAP = 10;
const FALLBACK_HEIGHT = 40;
const TRANSITION_MS = 400;

const isExpanded = ref(false);
const isTextClamped = ref(true);
let clampTimeout: ReturnType<typeof setTimeout> | undefined;

const collapsedHeights = ref(new Map<number, number>());
const textOverflows = ref(new Map<number, number>());
const toastElements = new Map<number, HTMLElement>();
const textElements = new Map<number, HTMLElement>();
const textElementIds = new WeakMap<Element, number>();

const gestureArea = ref<HTMLElement | null>(null);

const { isDragging, swipeTransform, swipeTransition } = useToastSwipe(
  gestureArea,
  {
    toastAt(target) {
      if (!(target instanceof Node)) return null;
      for (const [id, el] of toastElements) {
        if (!el.contains(target)) continue;
        const isDismissible = toasts.some(
          (toast) => toast.id === id && toast.dismissible,
        );
        return isDismissible ? { id, el } : null;
      }
      return null;
    },
    onSwipedAway: dismiss,
  },
);

// A toast must not time out from under the finger dragging it.
watch(isDragging, (dragging) => setIsHovered(dragging || isExpanded.value));

const textResizeObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    const id = textElementIds.get(target);
    if (id !== undefined) measureToast(id);
  }
});

onBeforeUnmount(() => {
  textResizeObserver.disconnect();
  clearTimeout(clampTimeout);
});

function progressPercent(toast: Toast) {
  if (!toast.progress?.total) return 0;
  return (toast.progress.current / toast.progress.total) * 100;
}

// The text box may be mid-transition, so the collapsed height is derived from
// the toast's chrome around it rather than read directly.
function measureToast(id: number) {
  const toast = toastElements.get(id);
  if (!toast) return;
  const text = textElements.get(id);
  const textBox = text?.parentElement;
  if (!text || !textBox) {
    collapsedHeights.value.set(id, toast.offsetHeight);
    return;
  }
  const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
  collapsedHeights.value.set(
    id,
    toast.offsetHeight - textBox.offsetHeight + lineHeight,
  );
  textOverflows.value.set(id, Math.max(0, text.scrollHeight - lineHeight));
}

function trackToast(id: number, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) {
    toastElements.set(id, el);
    measureToast(id);
  } else {
    toastElements.delete(id);
    collapsedHeights.value.delete(id);
    textOverflows.value.delete(id);
  }
}

function trackText(id: number, el: Element | ComponentPublicInstance | null) {
  const previous = textElements.get(id);
  if (el === previous) return;
  if (previous) textResizeObserver.unobserve(previous);
  if (el instanceof HTMLElement) {
    textElements.set(id, el);
    textElementIds.set(el, id);
    textResizeObserver.observe(el);
  } else {
    textElements.delete(id);
  }
}

function collapsedHeight(id: number) {
  return collapsedHeights.value.get(id) ?? FALLBACK_HEIGHT;
}

function expandedHeight(id: number) {
  return collapsedHeight(id) + (textOverflows.value.get(id) ?? 0);
}

function textHeight(id: number) {
  if (!isExpanded.value) return '1lh';
  return `calc(1lh + ${textOverflows.value.get(id) ?? 0}px)`;
}

function expand() {
  clearTimeout(clampTimeout);
  isTextClamped.value = false;
  isExpanded.value = true;
  setIsHovered(true);
}

function collapse() {
  if (!isExpanded.value) return;
  isExpanded.value = false;
  setIsHovered(false);
  // Clamping before the toast has shrunk would cut the extra lines off mid-transition.
  clampTimeout = setTimeout(() => (isTextClamped.value = true), TRANSITION_MS);
}

// Touch has no hover, and the mouse events a browser emulates after a tap
// would expand the stack on a tap meant for the close button. A tap on a toast
// expands it instead, and a press anywhere else collapses it.
function onPointerEnter(e: PointerEvent) {
  if (e.pointerType !== 'touch') expand();
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType !== 'touch') collapse();
}

function onStackClick(e: MouseEvent) {
  if (e.target instanceof Element && e.target.closest('button')) return;
  expand();
}

useEventListener(
  () => (isExpanded.value ? document : null),
  'pointerdown',
  (e: PointerEvent) => {
    if (!gestureArea.value?.contains(e.target as Node)) collapse();
  },
  { capture: true, passive: true },
);

watch(
  () => toasts.length,
  (count) => {
    if (count === 0) collapse();
  },
);

function getToastStyle(index: number) {
  const reversedIndex = toasts.length - 1 - index;
  const id = toasts[index]?.id ?? -1;
  const swipe = swipeTransform(id);

  let expandedOffset = 0;
  if (isExpanded.value) {
    for (let i = toasts.length - 1; i > index; i--) {
      const toast = toasts[i];
      if (toast) expandedOffset += expandedHeight(toast.id) + GAP;
    }
  }

  const baseStyle: any = {
    position: 'absolute',
    top: 0,
    zIndex: toasts.length - reversedIndex,
    transition: `all ${TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)${swipeTransition(id)}`,
  };

  if (isExpanded.value) {
    return {
      ...baseStyle,
      transform: `${swipe}translateY(${expandedOffset}px) scale(1)`,
      opacity: 1,
      pointerEvents: 'auto',
    };
  }

  if (reversedIndex >= VISIBLE_COUNT) {
    return {
      ...baseStyle,
      transform: `${swipe}translateY(${VISIBLE_COUNT * GAP}px) scale(${1 - VISIBLE_COUNT * 0.05})`,
      opacity: 0,
      pointerEvents: 'none',
    };
  }

  return {
    ...baseStyle,
    transform: `${swipe}translateY(${reversedIndex * GAP}px) scale(${1 - reversedIndex * 0.05})`,
    opacity: 1,
    pointerEvents: reversedIndex === 0 ? 'auto' : 'none',
  };
}

const totalHeight = computed(() => {
  if (toasts.length === 0) return 0;
  let height = 0;
  for (const toast of toasts) {
    height += expandedHeight(toast.id) + GAP;
  }
  return height - GAP;
});

const hitBoxHeight = computed(() => {
  if (toasts.length === 0) return 0;
  if (isExpanded.value) return totalHeight.value;
  const visibleStacks = Math.min(toasts.length - 1, VISIBLE_COUNT - 1);
  const front = toasts.at(-1);
  const frontHeight = front ? collapsedHeight(front.id) : FALLBACK_HEIGHT;
  return frontHeight + visibleStacks * GAP;
});
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed top-6 right-6 z-(--z-toast) max-w-[min(400px,calc(100vw-40px))] w-full max-sm:top-4 max-sm:right-0 max-sm:left-0 max-sm:max-w-[calc(100vw-32px)] max-sm:mx-auto"
      role="region"
      :aria-label="t('common.notifications')"
      aria-live="polite"
      style="pointer-events: none"
    >
      <div
        ref="gestureArea"
        class="relative w-full"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
        @click="onStackClick"
      >
        <div
          class="absolute top-0 left-0 w-full transition-all duration-400 ease-out-expo"
          :style="{
            height: hitBoxHeight + 'px',
            pointerEvents: toasts.length > 0 ? 'auto' : 'none',
          }"
        ></div>

        <TransitionGroup name="toast-stack" tag="div" class="relative w-full">
          <div
            v-for="(toast, index) in toasts"
            :key="toast.id"
            :ref="(el) => trackToast(toast.id, el)"
            class="w-full flex items-start gap-2 p-1 rounded-[20px] text-base/none overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] origin-top touch-pan-y"
            :class="ICON_COLORS[toast.type]"
            :style="getToastStyle(index)"
            :role="toast.progress ? 'status' : 'alert'"
            :aria-atomic="true"
          >
            <span
              class="ml-1.5 my-1.5 shrink-0 flex items-center justify-center size-5"
            >
              <BaseSpinner
                v-if="toast.progress"
                size="20px"
                color="currentColor"
              />
              <component :is="ICONS[toast.type]" v-else :size="20" />
            </span>

            <div
              v-if="toast.progress"
              class="my-1.5 flex-1 min-w-0 flex items-center gap-2.5"
              role="progressbar"
              :aria-label="toast.message"
              :aria-valuemin="0"
              :aria-valuemax="toast.progress.total"
              :aria-valuenow="toast.progress.current"
            >
              <span
                class="h-1.5 flex-1 min-w-0 rounded-full bg-current/15 overflow-hidden"
              >
                <span
                  class="block h-full rounded-full bg-current transition-[width] duration-400 ease-out-expo"
                  :style="{ width: progressPercent(toast) + '%' }"
                ></span>
              </span>
              <span class="shrink-0 text-sm leading-5 tabular-nums">
                {{ toast.progress.current }}/{{ toast.progress.total }}
              </span>
            </div>

            <div
              v-else
              class="my-1.5 flex-1 min-w-0 overflow-hidden text-base leading-5 transition-[height] duration-400 ease-out-expo"
              :style="{ height: textHeight(toast.id) }"
            >
              <span
                :ref="(el) => trackText(toast.id, el)"
                class="break-words"
                :class="isTextClamped ? 'line-clamp-1' : 'block'"
              >
                {{ toast.message }}
              </span>
            </div>

            <span v-if="!toast.dismissible" class="w-2.5 shrink-0"></span>
            <BaseButton
              v-else
              size="sm"
              :icon="X"
              :on="
                toast.type === 'success'
                  ? 'action'
                  : toast.type === 'error'
                    ? 'danger'
                    : 'ghost'
              "
              style="pointer-events: auto"
              @click="dismiss(toast.id)"
            />
            <div
              class="absolute inset-0 pointer-events-none transition-opacity duration-400 ease-out-expo bg-depth"
              :style="{
                opacity: isExpanded
                  ? 0
                  : Math.min(1, (toasts.length - 1 - index) * 0.2),
              }"
            ></div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ease-out-expo {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
.duration-400 {
  transition-duration: 400ms;
}

.toast-stack-enter-active,
.toast-stack-leave-active {
  transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Toasts are placed by inline transforms that ease on their own. Without a
   transition here, TransitionGroup skips its FLIP pass, which would take a
   swipe's instant transform for a move and wipe it. */
.toast-stack-move {
  transition: none !important;
}

.toast-stack-enter-from {
  opacity: 0 !important;
  transform: translateY(-24px) scale(0.9) !important;
}

.toast-stack-leave-to {
  opacity: 0 !important;
}
</style>
