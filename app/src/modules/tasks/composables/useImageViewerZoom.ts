import {
  computed,
  onScopeDispose,
  ref,
  type CSSProperties,
  type Ref,
} from 'vue';
import { drawnMatrix, findTouch, rubberBand } from '@/common/utils/gesture';
import { GLIDE_EASING, prefersReducedMotion } from '@/common/utils/motion';
import {
  SNAP_DURATION,
  TRANSITION_SLACK_MS,
} from '@/modules/tasks/utils/imageViewerMotion';

// The image never grows past this many times the size it fits the screen at.
const MAX_ZOOM = 4;
// A pinch past either end of the range follows the fingers at a falling rate,
// as the share of the scale it approaches but never reaches past that end.
const ZOOM_RUBBER_BAND = 0.5;

interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

interface ViewerZoomOptions {
  currentIndex: Ref<number>;
  viewport: { width: Readonly<Ref<number>>; height: Readonly<Ref<number>> };
  /** The element the zoom layer is rendered in. */
  root: () => HTMLElement | undefined;
}

function clampTo(value: number, limit: number) {
  return Math.min(limit, Math.max(-limit, value));
}

// Past either end of the range the scale follows the pinch less and less.
function bandZoom(scale: number) {
  if (scale < 1) return 1 - rubberBand(1 - scale, ZOOM_RUBBER_BAND);
  if (scale > MAX_ZOOM) {
    return MAX_ZOOM * (1 + rubberBand(scale / MAX_ZOOM - 1, ZOOM_RUBBER_BAND));
  }
  return scale;
}

/**
 * Pinch to zoom. The zoom sits on a layer of its own between the slide and the
 * frame, so the open and close animations keep the frame to themselves. It is
 * held in screen pixels from the viewport centre, around which the layer
 * scales. The image it belongs to keeps it while a page turn carries it off
 * screen.
 */
export function useImageViewerZoom(options: ViewerZoomOptions) {
  const { currentIndex, viewport } = options;

  const zoomedIndex = ref<number | null>(null);
  const scale = ref(1);
  const x = ref(0);
  const y = ref(0);
  const transition = ref<string | null>(null);
  let transitionTimer: ReturnType<typeof setTimeout> | null = null;

  const isZoomed = computed(
    () => zoomedIndex.value === currentIndex.value && scale.value > 1,
  );

  function zoomedAt(index: number) {
    return zoomedIndex.value === index && scale.value !== 1;
  }

  function zoomStyle(index: number): CSSProperties | undefined {
    if (index !== zoomedIndex.value) return undefined;
    return {
      transform: `translate3d(${x.value}px, ${y.value}px, 0) scale(${scale.value})`,
      transition: transition.value ?? 'none',
    };
  }

  function layer() {
    return (
      options.root()?.querySelector<HTMLElement>('[data-viewer-zoom]') ?? null
    );
  }

  function clearTransitionTimer() {
    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = null;
  }

  function reset() {
    clearTransitionTimer();
    zoomedIndex.value = null;
    scale.value = 1;
    x.value = 0;
    y.value = 0;
    transition.value = null;
  }

  /** Puts the zoom on the current image, dropping one left on another. */
  function claim() {
    if (zoomedIndex.value !== currentIndex.value) reset();
    zoomedIndex.value = currentIndex.value;
  }

  // How far off centre the image can sit at a scale before an edge of it comes
  // away from the edge of the viewport. Read from the layout, which transforms
  // leave alone, so it holds for a frame of known size and a bare image alike.
  function panLimits(at: number) {
    const content = layer()?.firstElementChild as HTMLElement | null;
    if (!content) return { x: 0, y: 0 };

    return {
      x: Math.max(0, (content.offsetWidth * at - viewport.width.value) / 2),
      y: Math.max(0, (content.offsetHeight * at - viewport.height.value) / 2),
    };
  }

  // The nearest state inside the limits: the scale brought back into range
  // around `focus`, which stays where it is on screen, and the image moved no
  // further than its edges allow at that scale.
  function nearestValid(state: ZoomState, focusX = 0, focusY = 0): ZoomState {
    const target = Math.min(Math.max(state.scale, 1), MAX_ZOOM);
    if (target === 1) return { scale: 1, x: 0, y: 0 };

    const ratio = target / state.scale;
    const limits = panLimits(target);
    return {
      scale: target,
      x: clampTo(focusX - ratio * (focusX - state.x), limits.x),
      y: clampTo(focusY - ratio * (focusY - state.y), limits.y),
    };
  }

  function animateTo(target: ZoomState, duration: number) {
    clearTransitionTimer();
    if (
      target.scale === scale.value &&
      target.x === x.value &&
      target.y === y.value
    ) {
      return;
    }

    if (prefersReducedMotion()) {
      transition.value = null;
    } else {
      transition.value = `transform ${duration}ms ${GLIDE_EASING}`;
      transitionTimer = setTimeout(() => {
        transitionTimer = null;
        transition.value = null;
      }, duration + TRANSITION_SLACK_MS);
    }

    scale.value = target.scale;
    x.value = target.x;
    y.value = target.y;
  }

  /** Back into range from wherever a gesture left it, `momentum` carried on. */
  function settle(duration = SNAP_DURATION, momentum = { x: 0, y: 0 }) {
    if (zoomedIndex.value !== currentIndex.value) return;
    const state = {
      scale: scale.value,
      x: x.value + momentum.x,
      y: y.value + momentum.y,
    };
    animateTo(nearestValid(state), duration);
  }

  // The same handover as for the track: a zoom still easing into place is
  // picked up where it is drawn, not where it is heading.
  function takeOver() {
    if (!transition.value) return;

    const el = layer();
    if (el) {
      const matrix = drawnMatrix(el);
      scale.value = matrix.a || 1;
      x.value = matrix.e;
      y.value = matrix.f;
    }

    clearTransitionTimer();
    transition.value = null;
  }

  // Pinch ------------------------------------------------------------------

  const pinch = {
    active: false,
    ids: [0, 0] as [number, number],
    startDistance: 1,
    start: { scale: 1, x: 0, y: 0 },
    // Relative to the viewport centre, like the zoom itself.
    startFocus: { x: 0, y: 0 },
    focus: { x: 0, y: 0 },
  };

  function focusOf(first: Touch, second: Touch) {
    return {
      x: (first.clientX + second.clientX) / 2 - viewport.width.value / 2,
      y: (first.clientY + second.clientY) / 2 - viewport.height.value / 2,
    };
  }

  /** Starts a pinch with the first two touches; false when there is none to start. */
  function startPinch(touches: TouchList) {
    const [first, second] = [touches[0], touches[1]];
    if (pinch.active || !first || !second) return false;

    const distance = Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );
    if (!distance) return false;

    takeOver();
    claim();

    pinch.active = true;
    pinch.ids = [first.identifier, second.identifier];
    pinch.startDistance = distance;
    pinch.start = { scale: scale.value, x: x.value, y: y.value };
    pinch.startFocus = focusOf(first, second);
    pinch.focus = pinch.startFocus;
    return true;
  }

  function pinchTouches(touches: TouchList) {
    const first = findTouch(touches, pinch.ids[0]);
    const second = findTouch(touches, pinch.ids[1]);
    return first && second ? ([first, second] as const) : null;
  }

  // The point of the image that was between the fingers when the pinch started
  // stays between them, so the image scales around the fingers and follows them
  // when they move together.
  function movePinch(event: TouchEvent) {
    const touches = pinchTouches(event.touches);
    if (!touches) return;
    if (event.cancelable) event.preventDefault();

    const [first, second] = touches;
    const distance = Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );
    const next = bandZoom((pinch.start.scale * distance) / pinch.startDistance);
    const ratio = next / pinch.start.scale;

    pinch.focus = focusOf(first, second);
    scale.value = next;
    x.value = pinch.focus.x - ratio * (pinch.startFocus.x - pinch.start.x);
    y.value = pinch.focus.y - ratio * (pinch.startFocus.y - pinch.start.y);
  }

  // Ends once either pinching finger lifts. The other one is left without a
  // gesture until it lifts too, since the one it started with is over.
  function endPinch(event: TouchEvent) {
    if (pinchTouches(event.touches)) return false;

    pinch.active = false;
    const state = { scale: scale.value, x: x.value, y: y.value };
    animateTo(nearestValid(state, pinch.focus.x, pinch.focus.y), SNAP_DURATION);
    return true;
  }

  function cancelPinch() {
    pinch.active = false;
  }

  onScopeDispose(clearTransitionTimer);

  return {
    zoomedIndex,
    scale,
    x,
    y,
    isZoomed,
    isPinching: () => pinch.active,
    zoomedAt,
    zoomStyle,
    reset,
    panLimits,
    settle,
    takeOver,
    startPinch,
    movePinch,
    endPinch,
    cancelPinch,
  };
}

export type ImageViewerZoom = ReturnType<typeof useImageViewerZoom>;
