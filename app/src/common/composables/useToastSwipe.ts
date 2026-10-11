import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { haptic } from '@/common/utils/haptics';
import {
  FLICK_VELOCITY,
  PULL_AGAINST_RESISTANCE,
  SNAP_BACK_MS,
  VelocityTracker,
  drawnMatrix,
  lockAxis,
} from '@/common/utils/gesture';
import {
  GLIDE_EASING,
  SETTLE_EASING,
  glideDuration,
} from '@/common/utils/motion';

/** The share of the toast's width a slow swipe must cover to dismiss it. */
const COMMIT_FRACTION = 0.35;
/** The shortest flick that still counts as one, rather than as a tap that moved. */
const FLICK_MIN_DISTANCE = 12;
const FLY_OUT_MS = { min: 160, max: 320 };
const ARMED_VIBRATION_MS = 10;

export interface SwipeableToast {
  id: number;
  el: HTMLElement;
}

export interface ToastSwipeOptions {
  /** The toast a press on `target` may swipe away, or null if there is none. */
  toastAt: (target: EventTarget | null) => SwipeableToast | null;
  /**
   * Runs as soon as a swipe commits, so the rest of the stack closes up while
   * the toast is still on its way out.
   */
  onSwipedAway: (id: number) => void;
}

const drawnOffset = (pull: number) =>
  pull < 0 ? pull : pull * PULL_AGAINST_RESISTANCE;

const pullOf = (offset: number) =>
  offset < 0 ? offset : offset / PULL_AGAINST_RESISTANCE;

/**
 * Touch only: a mouse has the close button. A toast follows the finger to the
 * left and only hints at a pull to the right. Let go far enough out, or
 * flicked left, it leaves the screen that way; otherwise it springs back.
 * One toast moves at a time, so the whole stack shares one gesture.
 */
export function useToastSwipe(
  area: Readonly<Ref<HTMLElement | null>>,
  options: ToastSwipeOptions,
) {
  const swipedId = ref<number | null>(null);
  const offset = ref(0);
  /** How the swiped toast's transform eases towards `offset`. */
  const motion = ref('0s');
  const isDragging = ref(false);
  const width = ref(0);

  let toast: SwipeableToast | null = null;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let pullAtStart = 0;
  let swallowClick = false;
  let settleTimeout: ReturnType<typeof setTimeout> | undefined;
  const tracker = new VelocityTracker();

  const isArmed = computed(
    () => width.value > 0 && offset.value <= -width.value * COMMIT_FRACTION,
  );

  watch(isArmed, () => {
    if (isDragging.value) haptic(ARMED_VIBRATION_MS);
  });

  function clear() {
    clearTimeout(settleTimeout);
    swipedId.value = null;
    offset.value = 0;
    motion.value = '0s';
  }

  function snapBack() {
    clearTimeout(settleTimeout);
    motion.value = `${SNAP_BACK_MS}ms ${SETTLE_EASING}`;
    offset.value = 0;
    settleTimeout = setTimeout(clear, SNAP_BACK_MS);
  }

  async function flyOut(id: number, el: HTMLElement, speed: number) {
    clearTimeout(settleTimeout);
    // Until its right edge has passed the left edge of the screen.
    const distance = Math.max(0, el.getBoundingClientRect().right);
    const duration = glideDuration(distance, speed, FLY_OUT_MS);
    motion.value = `${duration}ms ${GLIDE_EASING}`;
    offset.value -= distance;
    // A leaving toast keeps the style it was last rendered with, so it has to
    // be drawn heading out before it is dismissed.
    await nextTick();
    options.onSwipedAway(id);
    clear();
  }

  function release(time: number) {
    const velocity = tracker.velocity(time);
    tracker.reset();
    if (!toast) return;

    const isFlickAway =
      velocity <= -FLICK_VELOCITY && offset.value <= -FLICK_MIN_DISTANCE;
    if (isFlickAway || isArmed.value) {
      void flyOut(toast.id, toast.el, Math.max(0, -velocity));
    } else {
      snapBack();
    }
  }

  function endGesture(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!isDragging.value) return;
    isDragging.value = false;
    release(e.timeStamp);
  }

  function startDragging(e: PointerEvent) {
    isDragging.value = true;
    swallowClick = true;
    clearTimeout(settleTimeout);
    motion.value = '0s';
    try {
      // Keeps the toast following a finger that strays off it.
      area.value?.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone; its pointerup or cancel still ends the drag.
    }
  }

  useEventListener(area, 'pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    const pressed = options.toastAt(e.target);
    if (!pressed) return;

    const isCaughtSettling = swipedId.value === pressed.id;
    // Picks the toast up where it is drawn, not where it was heading.
    const caughtAt = isCaughtSettling ? drawnMatrix(pressed.el).m41 : 0;
    if (!isCaughtSettling) clear();

    toast = pressed;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    pullAtStart = pullOf(caughtAt);
    width.value = pressed.el.offsetWidth;
    swallowClick = false;
    tracker.reset();

    if (isCaughtSettling) {
      offset.value = caughtAt;
      startDragging(e);
    }
  });

  useEventListener(area, 'pointermove', (e: PointerEvent) => {
    if (e.pointerId !== pointerId || !toast) return;
    const dx = e.clientX - startX;

    if (!isDragging.value) {
      const axis = lockAxis(dx, e.clientY - startY);
      if (!axis) return;
      if (axis === 'y') {
        pointerId = null;
        return;
      }
      swipedId.value = toast.id;
      startDragging(e);
    }

    offset.value = drawnOffset(pullAtStart + dx);
    tracker.record(e.timeStamp, offset.value);
  });

  useEventListener(area, 'pointerup', endGesture);
  useEventListener(area, 'pointercancel', endGesture);

  // `touch-action: pan-y` alone still lets some mobile browsers scroll the
  // page along with the finger's vertical drift during a horizontal swipe.
  useEventListener(
    area,
    'touchmove',
    (e: TouchEvent) => {
      if (isDragging.value && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );

  // The click that ends a swipe must not reach the close button.
  useEventListener(
    area,
    'click',
    (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );

  onScopeDispose(() => clearTimeout(settleTimeout));

  /** The swiped toast's extra transform, to go before its place in the stack. */
  function swipeTransform(id: number) {
    return id === swipedId.value ? `translateX(${offset.value}px) ` : '';
  }

  /** Overrides how the swiped toast's transform eases, after its own transition. */
  function swipeTransition(id: number) {
    return id === swipedId.value ? `, transform ${motion.value}` : '';
  }

  return { isDragging, swipeTransform, swipeTransition };
}
