export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// An explicit `behavior: 'smooth'` overrides the stylesheet's
// `scroll-behavior: auto`, so scripted scrolls have to opt out themselves.
export function preferredScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

/**
 * Decelerates hard from a fast start, the way an iOS sheet glides into place.
 * Shared by slides and page turns so they all move as one material.
 */
export const GLIDE_CURVE = [0.32, 0.72, 0, 1] as const;
export const GLIDE_EASING = `cubic-bezier(${GLIDE_CURVE.join(', ')})`;

/** A gentler curve for something let go of, settling back where it rests. */
export const SETTLE_CURVE = [0.22, 1, 0.36, 1] as const;
export const SETTLE_EASING = `cubic-bezier(${SETTLE_CURVE.join(', ')})`;

/**
 * How long a glide over `distance` px takes to start at `speed` px/ms, the
 * speed a throw was released at, so the animation carries the gesture on
 * instead of restarting it. The glide starts out faster than a linear motion
 * by its curve's initial slope.
 */
export function glideDuration(
  distance: number,
  speed: number,
  { min, max }: { min: number; max: number },
) {
  if (speed <= 0) return max;
  const startSlope = GLIDE_CURVE[1] / GLIDE_CURVE[0];
  return Math.min(max, Math.max(min, (startSlope * distance) / speed));
}
