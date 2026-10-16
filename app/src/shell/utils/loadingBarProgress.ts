/**
 * The share of the bar a navigation can fill while it is still running. Only
 * a finished navigation completes it.
 */
export const TRICKLE_LIMIT = 0.92;

// The bar covers about 63% of the way to its limit within this time, fast
// enough that a typical navigation sees it move, then slows down the longer
// the navigation takes.
const TRICKLE_TIME_CONSTANT = 1600;

/** By then the bar sits within a pixel of its limit and stops. */
export const TRICKLE_DURATION = 14_000;

const KEYFRAME_COUNT = 48;

/**
 * How far the bar has filled `elapsed` ms after it set off from `from`,
 * easing towards the limit without ever reaching it. A bar already past the
 * limit, picked up from a completion that was cut short, holds where it is.
 */
export function trickleProgress(elapsed: number, from = 0) {
  const limit = Math.max(from, TRICKLE_LIMIT);
  return from - (limit - from) * Math.expm1(-elapsed / TRICKLE_TIME_CONSTANT);
}

/**
 * The trickle as keyframes for one linear animation over `TRICKLE_DURATION`.
 * They sample its curve densest at the start, where it bends most, so the
 * straight segments between them read as one continuous deceleration.
 */
export function trickleKeyframes(from = 0): Keyframe[] {
  return Array.from({ length: KEYFRAME_COUNT + 1 }, (_, index) => {
    const offset = (index / KEYFRAME_COUNT) ** 2;
    const progress = trickleProgress(offset * TRICKLE_DURATION, from);
    return { offset, transform: `scaleX(${progress})` };
  });
}
