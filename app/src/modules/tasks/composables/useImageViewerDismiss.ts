import { computed, onScopeDispose, ref, type Ref } from 'vue';
import {
  DISMISS_BACKDROP_FADE,
  FLICK_VELOCITY,
  PULL_AGAINST_RESISTANCE,
  rubberBand,
  SNAP_BACK_MS,
  unRubberBand,
} from '@/common/utils/gesture';
import { haptic } from '@/common/utils/haptics';
import { prefersReducedMotion, SETTLE_EASING } from '@/common/utils/motion';
import {
  dimAt,
  TRANSITION_SLACK_MS,
} from '@/modules/tasks/utils/imageViewerMotion';

// Lower than BaseSheet's numbers on purpose: there is nothing to read
// underneath the image, so letting go of it should be easy.
const DISMISS_DISTANCE = 60;
// The shortest flick that still counts as one, rather than as a tap that
// happened to move.
export const FLICK_MIN_DISTANCE = 12;
// How far the image travels sideways before it stops following the finger.
// The number is the share of the viewport width it approaches but never
// reaches, so the pull gets weaker the further out it goes.
const DISMISS_SIDEWAYS = 0.55;
// The distance the backdrop clears over. Spread over more than the dismiss
// distance, otherwise the picture would be left standing on a bare background
// long before the pull counts.
const DISMISS_FADE_DISTANCE = 200;
// How far the image shrinks over a whole screen of drag: a full screen takes
// it to 0.6, which is what makes it read as being pushed away.
const DISMISS_SCALE = 0.4;

interface ViewerDismissOptions {
  viewport: { width: Readonly<Ref<number>>; height: Readonly<Ref<number>> };
}

/**
 * Swipe down to close. The stage carries the whole viewer, so the image is
 * pushed away as one piece and the track keeps the horizontal offset to
 * itself. It stays where the gesture left it while the close runs, which is
 * what lets the frame fly from there into its tile.
 */
export function useImageViewerDismiss({ viewport }: ViewerDismissOptions) {
  const offset = ref(0);
  const sideways = ref(0);
  const transition = ref<string | null>(null);
  // How far the dim had got when a swipe caught the open halfway, 1 being the
  // backdrop at rest. The swipe fades from there instead of from full strength.
  const openDim = ref(1);
  let returnTimer: ReturnType<typeof setTimeout> | null = null;
  let offsetBase = 0;
  let sidewaysBase = 0;

  const sidewaysLimit = () => viewport.width.value * DISMISS_SIDEWAYS;

  // True from the first movement of a dismiss drag until the stage is back at
  // rest, the return transition included.
  const active = computed(
    () =>
      offset.value !== 0 || sideways.value !== 0 || transition.value !== null,
  );

  const scale = computed(() => {
    const pulled = Math.max(0, offset.value);
    if (!pulled || !viewport.height.value) return 1;
    return 1 - Math.min(pulled / viewport.height.value, 1) * DISMISS_SCALE;
  });

  // How far the pull has got, for what answers it rather than follows it.
  const progress = computed(() =>
    Math.min(Math.max(0, offset.value) / DISMISS_FADE_DISTANCE, 1),
  );

  const stageStyle = computed(() => ({
    transform: `translate3d(${sideways.value}px, ${offset.value}px, 0px) scale(${scale.value})`,
    transition: transition.value ?? 'none',
  }));

  const backdropStyle = computed(() => {
    if (!progress.value && !transition.value && openDim.value === 1) {
      return undefined;
    }

    return {
      ...dimAt(openDim.value * (1 - progress.value * DISMISS_BACKDROP_FADE)),
      transition: transition.value
        ? `background-color ${SNAP_BACK_MS}ms ease, backdrop-filter ${SNAP_BACK_MS}ms ease`
        : 'none',
    };
  });

  function clearReturnTimer() {
    if (returnTimer) clearTimeout(returnTimer);
    returnTimer = null;
  }

  function reset() {
    clearReturnTimer();
    offset.value = 0;
    sideways.value = 0;
    transition.value = null;
    openDim.value = 1;
  }

  /**
   * Takes over a stage caught on its way back up. The sideways lean is read
   * back through the rubber band, so picking it up does not snap it to a
   * different place than it was drawn at.
   */
  function grab() {
    offsetBase = offset.value;
    sidewaysBase = unRubberBand(sideways.value, sidewaysLimit());
    clearReturnTimer();
    transition.value = null;
  }

  function drag(dx: number, dy: number) {
    const wasPastDistance = offset.value > DISMISS_DISTANCE;
    const pulled = offsetBase + dy;
    // A pull upwards has nowhere to go, so it only hints at the movement.
    offset.value = pulled < 0 ? pulled * PULL_AGAINST_RESISTANCE : pulled;
    if (wasPastDistance !== offset.value > DISMISS_DISTANCE) haptic();
    // Sideways the image is not going anywhere, so it only leans after the
    // finger, and less the further it already leans.
    sideways.value = rubberBand(sidewaysBase + dx, sidewaysLimit());
  }

  /** Whether a pull let go of at `velocity` px/ms counts as closing the viewer. */
  function isEnough(velocity: number) {
    const pulled = offset.value;
    return (
      pulled > DISMISS_DISTANCE ||
      (velocity > FLICK_VELOCITY && pulled > FLICK_MIN_DISTANCE)
    );
  }

  /** The way back when the pull was not enough. */
  function returnToRest() {
    if (prefersReducedMotion()) {
      reset();
      return;
    }

    transition.value = `transform ${SNAP_BACK_MS}ms ${SETTLE_EASING}`;
    offset.value = 0;
    sideways.value = 0;
    // A swipe that caught the open halfway gives the dim back in full.
    openDim.value = 1;

    clearReturnTimer();
    returnTimer = setTimeout(() => {
      returnTimer = null;
      transition.value = null;
    }, SNAP_BACK_MS + TRANSITION_SLACK_MS);
  }

  onScopeDispose(clearReturnTimer);

  return {
    active,
    openDim,
    stageStyle,
    backdropStyle,
    reset,
    grab,
    drag,
    isEnough,
    returnToRest,
  };
}

export type ImageViewerDismiss = ReturnType<typeof useImageViewerDismiss>;
