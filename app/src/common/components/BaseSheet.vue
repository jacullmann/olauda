<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  DISMISS_BACKDROP_FADE,
  lockAxis,
  PULL_AGAINST_RESISTANCE,
  SNAP_BACK_MS,
  TOUCH_SLOP,
  VelocityTracker,
} from '@/common/utils/gesture';
import { SETTLE_EASING } from '@/common/utils/motion';
import { haptic } from '@/common/utils/haptics';
import { expandFrom, type MorphOrigin } from '@/common/utils/morph';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    open?: boolean;
    /**
     * Lifts the sheet and its backdrop over a fullscreen overlay that already
     * sits above the normal layers, such as the image viewer. Without it the
     * sheet opens underneath that overlay, and its backdrop never gets the
     * taps that dismiss it.
     */
    elevated?: boolean;
    /** Grows the sheet out of this on open, instead of sliding it up. */
    origin?: MorphOrigin | null;
  }>(),
  {
    open: true,
    elevated: false,
    origin: null,
  },
);

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'after-leave'): void;
}>();

const sheetEl = ref<HTMLElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const backdropComponent = ref<any>(null);

let dragStartX = 0;
let dragStartY = 0;
let currentDragY = 0;
let isDragging = false;
let isHorizontalDrag = false;
const dragVelocity = new VelocityTracker();
let dragHandled = false;
let isDragFromHandle = false;

const isDraggingDismiss = ref(false);

const DISMISS_THRESHOLD = 100;
/** Firmer than the image viewer's: a sheet holds a form that is easy to lose. */
const VELOCITY_THRESHOLD = 0.5;

function getBackdropEl(): HTMLElement | null {
  return backdropComponent.value?.$el || null;
}

watch(backdropComponent, (val) => {
  if (val) {
    const el = val.$el;
    if (el) {
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd);
      el.addEventListener('touchcancel', onTouchEnd);
    }
  }
});

function onTouchStart(e: TouchEvent) {
  if (!sheetEl.value) return;

  const target = e.target as HTMLElement;
  isDragFromHandle = !!target.closest('[data-drag-handle]');
  const isInsideSheet = sheetEl.value.contains(target);

  const scroller = target.closest('.overflow-y-auto');
  const scrollTop = scroller
    ? scroller.scrollTop
    : (scrollEl.value?.scrollTop ?? 0);
  if (isInsideSheet && !isDragFromHandle && scrollTop > 0) return;

  dragHandled = false;
  isDraggingDismiss.value = false;
  const touch = e.touches[0];
  if (!touch) return;
  dragStartX = touch.clientX;
  dragStartY = touch.clientY;
  dragVelocity.reset();
  dragVelocity.record(e.timeStamp, 0);
  currentDragY = 0;
  isDragging = true;
  isHorizontalDrag = false;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging || !sheetEl.value) return;
  const touch = e.touches[0];
  if (!touch) return;

  const deltaX = touch.clientX - dragStartX;
  const deltaY = touch.clientY - dragStartY;

  if (currentDragY === 0 && lockAxis(deltaX, deltaY) === 'x') {
    isHorizontalDrag = true;
    isDragging = false;
    return;
  }

  if (isHorizontalDrag) return;

  if (deltaY < 0 && !isDragFromHandle) {
    isDragging = false;
    return;
  }

  if (deltaY < 0) {
    sheetEl.value.style.transform = `translateY(${deltaY * PULL_AGAINST_RESISTANCE}px)`;
    sheetEl.value.style.transition = 'none';
    return;
  }

  if (deltaY > 0 && e.cancelable) {
    e.preventDefault();
  }

  const wasPastThreshold = currentDragY > DISMISS_THRESHOLD;
  currentDragY = deltaY;
  if (wasPastThreshold !== currentDragY > DISMISS_THRESHOLD) haptic();
  dragVelocity.record(e.timeStamp, deltaY);
  sheetEl.value.style.transform = `translateY(${deltaY}px)`;
  sheetEl.value.style.transition = 'none';

  const backdropEl = getBackdropEl();
  if (backdropEl) {
    const progress = Math.min(deltaY / DISMISS_THRESHOLD, 1);
    backdropEl.style.opacity = String(1 - progress * DISMISS_BACKDROP_FADE);
    backdropEl.style.transition = 'none';
  }
}

function onTouchEnd() {
  if (!isDragging || !sheetEl.value) return;
  isDragging = false;

  const wasDrag = Math.abs(currentDragY) >= TOUCH_SLOP;
  if (wasDrag) {
    dragHandled = true;
  }

  const velocity = dragVelocity.velocity(performance.now());
  const shouldDismiss =
    currentDragY > DISMISS_THRESHOLD ||
    (velocity > VELOCITY_THRESHOLD && currentDragY > 20);

  if (shouldDismiss) {
    isDraggingDismiss.value = true;
    sheetEl.value.style.transition =
      'transform 150ms cubic-bezier(0.32,0,0.67,1)';
    sheetEl.value.style.transform = 'translateY(100%)';

    const backdropEl = getBackdropEl();
    if (backdropEl) {
      backdropEl.style.transition = 'opacity 150ms ease';
      backdropEl.style.opacity = '0';
    }

    setTimeout(() => {
      emit('cancel');
      setTimeout(() => {
        isDraggingDismiss.value = false;
        if (sheetEl.value) {
          sheetEl.value.style.transform = '';
          sheetEl.value.style.transition = '';
        }
        if (backdropEl) {
          backdropEl.style.opacity = '';
          backdropEl.style.transition = '';
        }
        dragHandled = false;
      }, 300);
    }, 150);
  } else {
    sheetEl.value.style.transition = `transform ${SNAP_BACK_MS}ms ${SETTLE_EASING}`;
    sheetEl.value.style.transform = 'translateY(0)';

    const backdropEl = getBackdropEl();
    if (backdropEl) {
      backdropEl.style.transition = `opacity ${SNAP_BACK_MS}ms ease`;
      backdropEl.style.opacity = '1';
    }

    setTimeout(() => {
      dragHandled = false;
      if (sheetEl.value) {
        sheetEl.value.style.transform = '';
        sheetEl.value.style.transition = '';
      }
      if (backdropEl) {
        backdropEl.style.opacity = '';
        backdropEl.style.transition = '';
      }
    }, 220);
  }
}

function onSheetEnter(el: Element) {
  if (props.origin) expandFrom(el as HTMLElement, props.origin);
}

function onBackdropClick() {
  if (dragHandled) {
    dragHandled = false;
    return;
  }
  emit('cancel');
}

defineExpose({ sheetEl, scrollEl });
</script>

<template>
  <Teleport to="body">
    <Transition
      appear
      enter-active-class="animate-[fade-in_200ms_ease]"
      :leave-active-class="
        isDraggingDismiss ? '' : 'animate-[fade-out_280ms_ease_forwards]'
      "
    >
      <BaseBackdrop
        v-if="open"
        ref="backdropComponent"
        blur-size="sm"
        opacity="light"
        :class="elevated ? 'z-[100003]!' : ''"
        @cancel="onBackdropClick"
      />
    </Transition>

    <Transition
      appear
      :enter-active-class="
        origin ? '' : 'animate-[sheet-up_400ms_cubic-bezier(0.22,1,0.36,1)]'
      "
      :leave-active-class="
        isDraggingDismiss
          ? ''
          : 'animate-[sheet-down_150ms_cubic-bezier(0.32,0,0.67,1)_forwards]'
      "
      @enter="onSheetEnter"
      @after-leave="emit('after-leave')"
    >
      <!-- No overflow clipping here: Chromium drops the masks of backdrop
           filters (BaseScrollFade) under a rounded overflow clip, leaving a
           hard edge. The scroller rounds its own clip instead. -->
      <div
        v-if="open"
        ref="sheetEl"
        v-bind="$attrs"
        class="fixed bottom-0 left-0 right-0 flex flex-col bg-surface rounded-t-2xl shadow-menu max-h-[85dvh]"
        :class="elevated ? 'z-[100004]' : 'z-[var(--z-tooltip)]'"
        @click.stop
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <!-- Top border drawn above the content: sticky fades reach up to the
             sheet's edge and would otherwise paint over the border where it
             curves around the rounded corners. -->
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 z-30 rounded-t-2xl border-t border-ghost-border"
        />

        <!-- Overlays the scroller's top padding, so it always stays in place
             while sticky headers can still fade out underneath it. -->
        <div
          class="absolute top-0 inset-x-0 z-20 flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none select-none"
          data-drag-handle
        >
          <div
            class="w-16 h-1 rounded-full bg-on-ghost-subtle opacity-50 pointer-events-none"
          />
        </div>

        <!-- Clips like BaseModalCard's scroller, see there; the clip path
             rounds the top corners like the sheet's. -->
        <div
          ref="scrollEl"
          class="min-h-0 pt-6 pb-[max(--spacing(4),env(safe-area-inset-bottom))] overflow-x-hidden overflow-y-auto overscroll-contain bg-surface opacity-[.999] [clip-path:inset(0_round_var(--radius-2xl)_var(--radius-2xl)_0_0)]"
        >
          <slot></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
