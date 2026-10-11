import {
  ref,
  computed,
  watch,
  toValue,
  onScopeDispose,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import {
  usePointerSwipe,
  useElementBounding,
  useEventListener,
  executeTransition,
  until,
} from '@vueuse/core';
import { haptic } from '@/common/utils/haptics';
import { FLICK_VELOCITY, VelocityTracker } from '@/common/utils/gesture';
import { SETTLE_CURVE, SETTLE_EASING } from '@/common/utils/motion';

export interface SwipeToDismissOptions {
  enabled?: MaybeRefOrGetter<boolean>;
  /** How far the card rests aside, to the left, while its action buttons are shown. */
  revealWidth?: MaybeRefOrGetter<number>;
  /** The same for a swipe to the right; 0 leaves the card unable to go that way. */
  startRevealWidth?: MaybeRefOrGetter<number>;
  /** Share of the card's width past which letting go runs the action. */
  commitRatio?: number;
  /** Pressing inside must not count as a press outside that closes the card. */
  actions?: Readonly<Ref<HTMLElement | null>>;
  /** Asked before the card slides out; declining puts the card back. */
  confirmDismiss?: () => Promise<boolean>;
  onSlideOut: () => void;
  /** Runs when a swipe to the right goes all the way; the card then settles back. */
  onStartCommit?: () => void;
}

/** The edge of the card its action buttons appear at. */
export type SwipeSide = 'left' | 'right';

/** Shared with the card, whose corners round off on the same clock as it settles. */
export const SWIPE_SETTLE_MS = 380;
export const SWIPE_SETTLE_EASING = SETTLE_EASING;

const DEFAULT_REVEAL_WIDTH = 80;
const DEFAULT_COMMIT_RATIO = 0.6;
/** Keeps the full swipe clear of the resting point on narrow cards. */
const MIN_COMMIT_TRAVEL = 64;
/**
 * Wider than a pager's slop, and biased towards vertical: the card sits in a
 * list that scrolls, and a scroll that drifts sideways must stay a scroll.
 */
const POINTER_SWIPE_THRESHOLD = 10;
const HORIZONTAL_LOCK_RATIO = 1.2;
const SLIDE_OUT_OVERSHOOT = 20;
const ARMED_VIBRATION_MS = 10;

/**
 * Touch only: a mouse has the card's menu for the same actions, and dragging
 * with it would fight text selection. Swiping the card right to left reveals
 * its action buttons behind it, left to right the ones on the other side.
 * Letting go past half of them, or flicking towards them, snaps the card open
 * onto them; swiping on past `commitRatio` of the card's width runs the main
 * action without the tap. `swipeOffset` is positive while the card is pulled
 * left and negative while it is pulled right; `animatedOffset` is where the
 * card and its buttons are drawn on the way there.
 */
export function useSwipeToDismiss(
  target: Ref<HTMLElement | null>,
  options: SwipeToDismissOptions,
) {
  const revealWidth = computed(() =>
    toValue(options.revealWidth ?? DEFAULT_REVEAL_WIDTH),
  );
  const startRevealWidth = computed(() =>
    toValue(options.startRevealWidth ?? 0),
  );
  const hasStartSide = computed(() => startRevealWidth.value > 0);
  const commitRatio = options.commitRatio ?? DEFAULT_COMMIT_RATIO;
  const gestureTarget = computed(() =>
    toValue(options.enabled ?? true) ? target.value : null,
  );

  const swipeOffset = ref(0);
  const isSwiping = ref(false);
  const openSide = ref<SwipeSide | null>(null);
  /** Outlasts the offset's return to 0, so the buttons stay on their side while the card slides back. */
  const activeSide = ref<SwipeSide>('right');
  const isDismissing = ref(false);

  /**
   * Where the card and its buttons are drawn: with the finger while swiping,
   * easing towards `swipeOffset` once let go. Everything is drawn from this one
   * value frame by frame, as the card's transform on its own would ease on
   * the compositor while the buttons' widths ease on the main thread, and
   * drift from the card's edge whenever that thread is busy.
   */
  const animatedOffset = ref(0);
  let settleRun = 0;
  watch(
    [swipeOffset, isSwiping],
    ([offset, swiping]) => {
      const run = ++settleRun;
      if (swiping || animatedOffset.value === offset) {
        animatedOffset.value = offset;
        return;
      }
      void executeTransition(animatedOffset, animatedOffset.value, offset, {
        duration: SWIPE_SETTLE_MS,
        easing: [...SETTLE_CURVE],
        abort: () => run !== settleRun,
      });
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => settleRun++);

  const isActionsVisible = computed(
    () => animatedOffset.value !== 0 || isSwiping.value,
  );

  const { width: elementWidth } = useElementBounding(gestureTarget);
  const commitOffsetBeyond = (reveal: number) =>
    Math.max(elementWidth.value * commitRatio, reveal + MIN_COMMIT_TRAVEL);
  const isArmed = computed(
    () => swipeOffset.value >= commitOffsetBeyond(revealWidth.value),
  );
  const isStartArmed = computed(
    () =>
      hasStartSide.value &&
      -swipeOffset.value >= commitOffsetBeyond(startRevealWidth.value),
  );

  let gestureDecided = false;
  let gestureLockedHorizontal = false;
  let offsetAtGestureStart = 0;
  let swallowNextClick = false;
  const tracker = new VelocityTracker();

  watch(animatedOffset, (offset) => {
    if (offset !== 0) activeSide.value = offset > 0 ? 'right' : 'left';
  });

  watch([isArmed, isStartArmed], () => {
    if (isSwiping.value) haptic(ARMED_VIBRATION_MS);
  });

  function open(side: SwipeSide) {
    openSide.value = side;
    swipeOffset.value =
      side === 'right' ? revealWidth.value : -startRevealWidth.value;
  }

  function close() {
    openSide.value = null;
    swipeOffset.value = 0;
  }

  async function dismiss() {
    if (isDismissing.value) return;
    isDismissing.value = true;
    openSide.value = null;
    isSwiping.value = false;

    if (options.confirmDismiss) {
      // Rests on the action buttons while the question is open. Not `open()`:
      // a press inside the dialog would count as a press outside the card.
      swipeOffset.value = revealWidth.value;
      const confirmed = await options.confirmDismiss();
      if (!confirmed) {
        isDismissing.value = false;
        close();
        return;
      }
    }

    swipeOffset.value = elementWidth.value + SLIDE_OUT_OVERSHOOT;
    // Done once the card is out of sight, not once its easing has crept to a stop.
    await until(animatedOffset).toMatch(
      (offset) => offset >= elementWidth.value,
    );
    options.onSlideOut();
  }

  function settle() {
    if (isDismissing.value) return;
    isSwiping.value = false;
    // Positive while the card is heading left.
    const velocity = tracker.velocity(performance.now());
    tracker.reset();

    if (!gestureLockedHorizontal) close();
    else if (isArmed.value) void dismiss();
    else if (isStartArmed.value) {
      close();
      options.onStartCommit?.();
    } else settleTowardsSide(velocity);
  }

  function settleTowardsSide(velocity: number) {
    const side: SwipeSide = swipeOffset.value >= 0 ? 'right' : 'left';
    const reveal =
      side === 'right' ? revealWidth.value : startRevealWidth.value;
    const towardsButtons = side === 'right' ? velocity : -velocity;

    if (towardsButtons >= FLICK_VELOCITY) open(side);
    else if (towardsButtons <= -FLICK_VELOCITY) close();
    else if (Math.abs(swipeOffset.value) >= reveal / 2) open(side);
    else close();
  }

  const { distanceX, distanceY } = usePointerSwipe(gestureTarget, {
    threshold: POINTER_SWIPE_THRESHOLD,
    pointerTypes: ['touch'],
    onSwipeStart() {
      if (isDismissing.value) return;
      gestureDecided = false;
      gestureLockedHorizontal = false;
      offsetAtGestureStart = swipeOffset.value;
      swallowNextClick = openSide.value !== null;
      tracker.reset();
    },
    onSwipe() {
      if (isDismissing.value) return;

      // Positive when the pointer has moved to the left.
      const dx = distanceX.value;
      const dy = Math.abs(distanceY.value);

      if (!gestureDecided) {
        gestureDecided = true;
        gestureLockedHorizontal = Math.abs(dx) > dy * HORIZONTAL_LOCK_RATIO;
        isSwiping.value = gestureLockedHorizontal;
        if (gestureLockedHorizontal) swallowNextClick = true;
      }

      if (!gestureLockedHorizontal) {
        close();
        return;
      }

      const minOffset = hasStartSide.value ? -Infinity : 0;
      swipeOffset.value = Math.max(minOffset, offsetAtGestureStart + dx);

      tracker.record(performance.now(), swipeOffset.value);
    },
    onSwipeEnd: settle,
  });

  // The browser cancels the pointer once it takes a vertical drag over for
  // scrolling, so no swipe end ever arrives.
  useEventListener(gestureTarget, 'pointercancel', settle, { passive: true });

  // `touch-action: pan-y` alone still lets some mobile browsers scroll the
  // page along with the finger's vertical drift during a horizontal swipe.
  useEventListener(
    gestureTarget,
    'touchmove',
    (e: TouchEvent) => {
      if (isSwiping.value && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );

  // A tap on an open card only closes it, and the click that ends a swipe
  // must not reach the card's controls.
  useEventListener(
    gestureTarget,
    'click',
    (e: MouseEvent) => {
      if (!swallowNextClick) return;
      swallowNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if (!gestureLockedHorizontal) close();
    },
    { capture: true },
  );

  useEventListener(
    () => (openSide.value ? document : null),
    'pointerdown',
    (e: PointerEvent) => {
      const pressed = e.target as Node;
      if (target.value?.contains(pressed)) return;
      if (options.actions?.value?.contains(pressed)) return;
      close();
    },
    { capture: true, passive: true },
  );

  watch(target, () => {
    swipeOffset.value = 0;
    isSwiping.value = false;
    openSide.value = null;
    isDismissing.value = false;
    settleRun++;
    animatedOffset.value = 0;
  });

  return {
    swipeOffset,
    animatedOffset,
    isSwiping,
    isArmed,
    isStartArmed,
    activeSide,
    isDismissing,
    isActionsVisible,
    dismiss,
    close,
  };
}
