import { computed, ref, watch, type Ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { haptic } from '@/common/utils/haptics';
import {
  FLICK_VELOCITY,
  SNAP_BACK_MS,
  TOUCH_SLOP,
  VelocityTracker,
  drawnMatrix,
  rubberBand,
  unRubberBand,
} from '@/common/utils/gesture';
import {
  GLIDE_EASING,
  SETTLE_EASING,
  glideDuration,
} from '@/common/utils/motion';

/**
 * The share of the card's own size a slow swipe must cover to send it away:
 * of its width sideways, of its height upwards, and in between on a diagonal.
 */
const COMMIT_FRACTION = 0.35;
/** The furthest a pull down moves the card, in px: there is nowhere to send it. */
const DOWN_PULL_LIMIT = 24;
/** How closely a pull down follows the finger at first. */
const DOWN_PULL_STIFFNESS = 0.3;
/** The shortest flick that still counts as one, rather than as a tap that moved. */
const FLICK_MIN_DISTANCE = 12;
const FLY_OUT_MS = { min: 160, max: 320 };
const ARMED_VIBRATION_MS = 10;

export interface SwipeAwayOptions {
  /** Runs once the card is out of sight; it stays there until `reset()`. */
  onSwipedAway: () => void;
}

interface Point {
  x: number;
  y: number;
}

const drawnY = (pullY: number) =>
  pullY < 0 ? pullY : rubberBand(pullY, DOWN_PULL_LIMIT, DOWN_PULL_STIFFNESS);

const pullYOf = (y: number) =>
  y < 0 ? y : unRubberBand(y, DOWN_PULL_LIMIT, DOWN_PULL_STIFFNESS);

/**
 * Touch only: a mouse has the button for the same thing. The card follows the
 * finger freely left, right and up, and only hints at a pull down. Let go far
 * enough out, or flicked any way but down, it leaves the screen in that
 * direction; otherwise it springs back.
 */
export function useSwipeAway(
  target: Readonly<Ref<HTMLElement | null>>,
  options: SwipeAwayOptions,
) {
  const offset = ref<Point>({ x: 0, y: 0 });
  const size = ref({ width: 0, height: 0 });
  const isDragging = ref(false);
  /** From the moment a swipe commits until the card is put back. */
  const isGone = ref(false);

  let pointerId: number | null = null;
  let start: Point = { x: 0, y: 0 };
  /** The finger's pull the gesture picked the card up at, before any rubber band. */
  let pullAtStart: Point = { x: 0, y: 0 };
  let swallowClick = false;
  let running: Animation | null = null;
  const trackerX = new VelocityTracker();
  const trackerY = new VelocityTracker();

  const isAtRest = computed(() => offset.value.x === 0 && offset.value.y === 0);

  const isArmed = computed(() => {
    const { width, height } = size.value;
    if (!width || !height) return false;
    const across = offset.value.x / (width * COMMIT_FRACTION);
    const up = Math.min(0, offset.value.y) / (height * COMMIT_FRACTION);
    return Math.hypot(across, up) >= 1;
  });

  watch(isArmed, () => {
    if (isDragging.value) haptic(ARMED_VIBRATION_MS);
  });

  const transformAt = ({ x, y }: Point) => `translate(${x}px, ${y}px)`;

  const swipeStyle = computed(() =>
    isAtRest.value ? undefined : { transform: transformAt(offset.value) },
  );

  function stopRunning() {
    if (!running) return;
    // Picks the card up where it is drawn, not where it was heading.
    const { m41, m42 } = drawnMatrix(target.value);
    offset.value = { x: m41, y: m42 };
    running.cancel();
    running = null;
  }

  /** Resolves to whether the card got there, rather than being picked up or reset. */
  async function animateTo(to: Point, duration: number, easing: string) {
    const el = target.value;
    const from = offset.value;
    // The animation draws over the inline style, which already holds the end.
    offset.value = to;
    if (!el || (from.x === to.x && from.y === to.y)) return true;
    const animation = el.animate(
      [{ transform: transformAt(from) }, { transform: transformAt(to) }],
      { duration, easing },
    );
    running = animation;
    try {
      await animation.finished;
      return true;
    } catch {
      return false;
    } finally {
      if (running === animation) running = null;
    }
  }

  /** How far the card travels along `direction` until all of it is off screen. */
  function distanceOffScreen(direction: Point) {
    const rect = target.value?.getBoundingClientRect();
    if (!rect) return 0;
    const exits = [
      direction.x > 0 && (window.innerWidth - rect.left) / direction.x,
      direction.x < 0 && rect.right / -direction.x,
      direction.y < 0 && rect.bottom / -direction.y,
    ].filter((distance): distance is number => distance !== false);
    return Math.min(...exits);
  }

  async function flyOut(direction: Point, speed: number) {
    isGone.value = true;
    const distance = distanceOffScreen(direction);
    const to = {
      x: offset.value.x + direction.x * distance,
      y: offset.value.y + direction.y * distance,
    };
    const duration = glideDuration(distance, speed, FLY_OUT_MS);
    if (await animateTo(to, duration, GLIDE_EASING)) options.onSwipedAway();
  }

  /** `vector` without its downward part, scaled to length 1; null if nothing is left. */
  function awayDirection(vector: Point): Point | null {
    const x = vector.x;
    const y = Math.min(0, vector.y);
    const length = Math.hypot(x, y);
    return length ? { x: x / length, y: y / length } : null;
  }

  function release(time: number) {
    const velocity = {
      x: trackerX.velocity(time),
      y: trackerY.velocity(time),
    };
    trackerX.reset();
    trackerY.reset();

    const { x, y } = offset.value;
    const isFlick =
      Math.hypot(velocity.x, velocity.y) >= FLICK_VELOCITY &&
      Math.hypot(x, y) >= FLICK_MIN_DISTANCE;
    // A flick down, or back towards where the card rests, calls it off.
    const isFlickAway =
      velocity.y <= Math.abs(velocity.x) && velocity.x * x + velocity.y * y > 0;

    const direction = isFlick
      ? isFlickAway
        ? awayDirection(velocity)
        : null
      : isArmed.value
        ? awayDirection(offset.value)
        : null;

    if (direction) {
      void flyOut(
        direction,
        Math.max(0, velocity.x * direction.x + velocity.y * direction.y),
      );
    } else {
      void animateTo({ x: 0, y: 0 }, SNAP_BACK_MS, SETTLE_EASING);
    }
  }

  function endGesture(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const wasDragging = isDragging.value;
    isDragging.value = false;
    if (wasDragging) release(e.timeStamp);
  }

  useEventListener(target, 'pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !e.isPrimary || isGone.value) return;
    stopRunning();
    pointerId = e.pointerId;
    start = { x: e.clientX, y: e.clientY };
    pullAtStart = { x: offset.value.x, y: pullYOf(offset.value.y) };
    swallowClick = false;
    const el = target.value;
    size.value = {
      width: el?.offsetWidth ?? 0,
      height: el?.offsetHeight ?? 0,
    };
    trackerX.reset();
    trackerY.reset();
    // A card caught on its way back is already being dragged.
    isDragging.value = !isAtRest.value;
  });

  useEventListener(target, 'pointermove', (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!isDragging.value) {
      if (Math.hypot(dx, dy) < TOUCH_SLOP) return;
      isDragging.value = true;
      // Keeps the card following a finger that strays off it.
      target.value?.setPointerCapture(e.pointerId);
    }

    swallowClick = true;
    offset.value = {
      x: pullAtStart.x + dx,
      y: drawnY(pullAtStart.y + dy),
    };
    trackerX.record(e.timeStamp, offset.value.x);
    trackerY.record(e.timeStamp, pullAtStart.y + dy);
  });

  useEventListener(target, 'pointerup', endGesture);
  useEventListener(target, 'pointercancel', endGesture);

  // The click that ends a swipe must not reach the card's buttons.
  useEventListener(
    target,
    'click',
    (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );

  /** Puts the card back in place, without animating, for what shows next. */
  function reset() {
    running?.cancel();
    running = null;
    pointerId = null;
    isDragging.value = false;
    isGone.value = false;
    offset.value = { x: 0, y: 0 };
  }

  watch(target, reset);

  return { swipeStyle, isDragging, isGone, reset };
}
