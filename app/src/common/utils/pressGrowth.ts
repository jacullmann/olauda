import { prefersReducedMotion } from './motion';

/** A pause before the swell begins, so taps and the start of a scroll never show it. */
const GROW_DELAY_MS = 100;

/**
 * How far the held element widens in total. Growing by a distance rather than
 * a ratio keeps a full-width card from swelling far more than a small tile.
 */
const GROW_DISTANCE_PX = 10;
const MAX_GROW_RATIO = 0.05;

/** Starts gently and gathers pace, so the hold reads as building toward something. */
const GROW_EASING = 'cubic-bezier(0.4, 0, 0.7, 1)';

const RELEASE_DURATION_MS = 220;
const RELEASE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

const SETTLE_DURATION_MS = 520;
const SETTLE_FALLBACK_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

const ANIMATION_ID = 'press-growth';

export interface PressGrowth {
  /** The hold was abandoned: shrink back quickly. */
  release(): void;
  /** The hold completed: spring back as the action takes over. */
  settle(): void;
  /**
   * The hold completed and the caller animates the scale from here on: stops
   * the growth where it is and returns the scale it reached.
   */
  handOver(): number;
}

const NO_GROWTH: PressGrowth = { release() {}, settle() {}, handOver: () => 1 };

function currentScale(el: HTMLElement) {
  const scale = parseFloat(getComputedStyle(el).scale);

  return Number.isFinite(scale) ? scale : 1;
}

/** Shares the app's spring curve so the settle matches every other entrance. */
function springEasing() {
  const spring = getComputedStyle(document.documentElement)
    .getPropertyValue('--ease-spring')
    .trim();

  return spring.startsWith('linear(') ? spring : SETTLE_FALLBACK_EASING;
}

function animateScale(
  el: HTMLElement,
  from: number,
  to: number,
  options: KeyframeAnimationOptions,
) {
  const animation = el.animate([{ scale: from }, { scale: to }], options);
  animation.id = ANIMATION_ID;

  return animation;
}

/** Stops whatever growth is still playing and returns the scale it had reached. */
function interruptGrowth(el: HTMLElement) {
  const reached = currentScale(el);

  for (const animation of el.getAnimations()) {
    if (animation.id === ANIMATION_ID) animation.cancel();
  }

  return reached;
}

/**
 * Swells an element under a resting finger for the length of the hold, the way
 * iOS answers a haptic touch, so the user can feel the action approaching.
 *
 * Animates the `scale` property rather than `transform`, so it composes with
 * any transform the element already carries, such as a swipe offset. Nothing
 * is left on the element once it is back at rest: a lingering scale would make
 * it a containing block and trap fixed-position menus rendered inside.
 */
export function growWhilePressed(
  el: HTMLElement,
  holdDuration: number,
): PressGrowth {
  if (prefersReducedMotion() || typeof el.animate !== 'function') {
    return NO_GROWTH;
  }

  const from = interruptGrowth(el);
  const grown = 1 + Math.min(GROW_DISTANCE_PX / el.offsetWidth, MAX_GROW_RATIO);

  animateScale(el, from, grown, {
    duration: Math.max(holdDuration - GROW_DELAY_MS, 0),
    delay: GROW_DELAY_MS,
    easing: GROW_EASING,
    fill: 'both',
  });

  function returnToRest(options: KeyframeAnimationOptions) {
    const reached = interruptGrowth(el);

    if (reached === 1) return;

    animateScale(el, reached, 1, options);
  }

  return {
    release: () =>
      returnToRest({ duration: RELEASE_DURATION_MS, easing: RELEASE_EASING }),
    settle: () =>
      returnToRest({ duration: SETTLE_DURATION_MS, easing: springEasing() }),
    handOver: () => interruptGrowth(el),
  };
}
