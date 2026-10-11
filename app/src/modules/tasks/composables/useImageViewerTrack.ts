import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  type CSSProperties,
  type Ref,
} from 'vue';
import { drawnMatrix, EDGE_RESISTANCE } from '@/common/utils/gesture';
import { GLIDE_EASING, prefersReducedMotion } from '@/common/utils/motion';
import {
  SLIDE_DURATION,
  SNAP_DURATION,
  TRANSITION_SLACK_MS,
} from '@/modules/tasks/utils/imageViewerMotion';

// The gap between two images on the slide track, on top of the padding each of
// them already keeps to the viewport edge.
const SLIDE_GAP = 16;

interface ViewerTrackOptions {
  currentIndex: Ref<number>;
  count: () => number;
  viewportWidth: Readonly<Ref<number>>;
  /** Whether only the current slide belongs on screen, as while it is swiped away. */
  hidesNeighbours: () => boolean;
  /** Once a slide has played out, or at once when it does not animate. */
  onSettled: () => void;
  /** As soon as the page turns, before the slide has played out. */
  onTurn: () => void;
}

/**
 * Every mounted image sits at its own index on one long horizontal track, and
 * the track is what moves: a drag offsets it by the finger, a page turn
 * animates it to the next stop. That way the button and the gesture drive the
 * same movement, and a turn started mid-drag continues from where the finger
 * left the track rather than from a standstill.
 */
export function useImageViewerTrack(options: ViewerTrackOptions) {
  const { currentIndex, viewportWidth } = options;

  const trackRef = ref<HTMLElement | null>(null);
  const dragOffset = ref(0);
  const transition = ref<string | null>(null);
  // The index the track is still travelling away from. It stays mounted so it
  // does not vanish out of the middle of its own slide.
  const travellingFrom = ref<number | null>(null);
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const hasNext = computed(() => currentIndex.value < options.count() - 1);
  const hasPrev = computed(() => currentIndex.value > 0);

  // One image per viewport width, plus the gap between two of them.
  const pageStep = computed(() => viewportWidth.value + SLIDE_GAP);

  const slides = computed(() => {
    const from = travellingFrom.value ?? currentIndex.value;
    const first = Math.max(0, Math.min(from, currentIndex.value) - 1);
    const last = Math.min(
      options.count() - 1,
      Math.max(from, currentIndex.value) + 1,
    );

    const indices: number[] = [];
    for (let index = first; index <= last; index++) indices.push(index);
    return indices;
  });

  const trackStyle = computed(() => ({
    transform: `translate3d(${dragOffset.value - currentIndex.value * pageStep.value}px, 0, 0)`,
    transition: transition.value ?? 'none',
  }));

  function slideStyle(index: number): CSSProperties {
    return {
      transform: `translate3d(${index * pageStep.value}px, 0, 0)`,
      // The stage shrinks and leans as it is swiped away, which brings the
      // images parked beside the current one back into the viewport.
      visibility:
        options.hidesNeighbours() && index !== currentIndex.value
          ? 'hidden'
          : undefined,
    };
  }

  function clearSettleTimer() {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
  }

  // The transition is dropped once it has played out, so the next drag picks
  // the track up without having to fight a transition that is still installed.
  function settle(duration: number) {
    clearSettleTimer();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      transition.value = null;
      travellingFrom.value = null;
      options.onSettled();
    }, duration + TRANSITION_SLACK_MS);
  }

  /**
   * Takes the track over where it is drawn, which during a slide is somewhere
   * between two stops, so grabbing a moving track picks it up rather than
   * snapping it. Returns that offset.
   */
  function grab() {
    const el = trackRef.value;
    const offset = el
      ? drawnMatrix(el).m41 + currentIndex.value * pageStep.value
      : dragOffset.value;
    clearSettleTimer();
    transition.value = null;
    dragOffset.value = offset;
    return offset;
  }

  /** Follows a drag to `offset`, giving way past the first or last image. */
  function drag(offset: number) {
    const pulling = offset > 0 ? !hasPrev.value : !hasNext.value;
    dragOffset.value = pulling ? offset * EDGE_RESISTANCE : offset;
  }

  function slideTo(index: number, duration = SLIDE_DURATION) {
    if (index === currentIndex.value || index < 0) return;
    if (index > options.count() - 1) return;

    const animate = !prefersReducedMotion();
    if (animate) {
      transition.value = `transform ${duration}ms ${GLIDE_EASING}`;
      travellingFrom.value = currentIndex.value;
      settle(duration);
    } else {
      transition.value = null;
      travellingFrom.value = null;
      clearSettleTimer();
    }

    dragOffset.value = 0;
    currentIndex.value = index;
    if (!animate) options.onSettled();
    void nextTick(options.onTurn);
  }

  function next() {
    if (hasNext.value) slideTo(currentIndex.value + 1);
  }

  function prev() {
    if (hasPrev.value) slideTo(currentIndex.value - 1);
  }

  /** Back to the stop it left, for a drag that did not turn the page. */
  function snapBack() {
    if (dragOffset.value === 0) {
      settle(0);
      return;
    }
    transition.value = prefersReducedMotion()
      ? null
      : `transform ${SNAP_DURATION}ms ${GLIDE_EASING}`;
    dragOffset.value = 0;
    settle(SNAP_DURATION);
  }

  function reset() {
    clearSettleTimer();
    dragOffset.value = 0;
    transition.value = null;
    travellingFrom.value = null;
  }

  onScopeDispose(clearSettleTimer);

  return {
    trackRef,
    dragOffset,
    hasNext,
    hasPrev,
    pageStep,
    slides,
    trackStyle,
    slideStyle,
    settle,
    grab,
    drag,
    slideTo,
    next,
    prev,
    snapBack,
    reset,
  };
}

export type ImageViewerTrack = ReturnType<typeof useImageViewerTrack>;
