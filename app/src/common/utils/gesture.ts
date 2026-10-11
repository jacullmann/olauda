/**
 * The numbers every touch gesture in the app shares, so swiping a pager, a
 * tab pill or a picture feels like handling the same material.
 */

/**
 * How far a touch travels before its direction is settled, in px. Shorter than
 * the distance a browser lets a touch wander before it starts scrolling on its
 * own, so a sideways pan is claimed while a scroll can still be called off.
 */
export const TOUCH_SLOP = 6;

/**
 * How far a resting finger may drift before a hold is read as a scroll, in px:
 * the allowance iOS gives its long press.
 */
export const HOLD_TOLERANCE = 10;

/** Only the finger's most recent movement counts towards its release speed, in ms. */
export const VELOCITY_WINDOW_MS = 100;

/** A release faster than this decides by its direction alone, in px/ms. */
export const FLICK_VELOCITY = 0.3;

/** Faster than any real flick, in px/ms; caps a speed spiked by a jittery sample. */
export const MAX_FLING_SPEED = 4;

/** How much of a pull past the first or last page the track follows. */
export const EDGE_RESISTANCE = 0.3;

/** The share of the width a slow swipe must cover to turn a page. */
export const PAGE_COMMIT_FRACTION = 0.3;

/**
 * Shortest a thrown slide may take, in ms: past this the movement stops
 * reading as the finger's and starts reading as a cut.
 */
export const MIN_GLIDE_MS = 200;

export type Axis = 'x' | 'y';

/** The axis a touch has committed to, or null while it is still within the slop. */
export function lockAxis(
  dx: number,
  dy: number,
  slop = TOUCH_SLOP,
): Axis | null {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (Math.max(x, y) < slop) return null;
  return x > y ? 'x' : 'y';
}

/** How closely a pull past a scroll view's edge follows the finger on iOS. */
export const SCROLL_EDGE_STIFFNESS = 0.55;

/**
 * Follows a pull less and less the further out it goes, never reaching
 * `limit`. `stiffness` is how closely it follows at first: 1 starts out 1:1.
 */
export function rubberBand(distance: number, limit: number, stiffness = 1) {
  if (!limit) return 0;
  const pulled = Math.abs(distance) * stiffness;
  return Math.sign(distance) * ((pulled * limit) / (limit + pulled));
}

/**
 * The pull `rubberBand` turned into `offset`, so a drag can be picked up again
 * where the last one left off rather than where the finger had to be for it.
 */
export function unRubberBand(offset: number, limit: number, stiffness = 1) {
  const banded = Math.abs(offset);
  if (!limit || banded >= limit) return offset;
  return (
    (Math.sign(offset) * ((banded * limit) / (limit - banded))) / stiffness
  );
}

export function findTouch(touches: TouchList, id: number) {
  return Array.from(touches).find((touch) => touch.identifier === id);
}

/** The transform an element is drawn with right now, mid-transition included. */
export function drawnMatrix(el: Element | null | undefined) {
  if (!el) return new DOMMatrixReadOnly();
  try {
    const { transform } = getComputedStyle(el);
    return !transform || transform === 'none'
      ? new DOMMatrixReadOnly()
      : new DOMMatrixReadOnly(transform);
  } catch {
    return new DOMMatrixReadOnly();
  }
}

/**
 * The speed of a pointer along one axis at release, fitted to all its recent
 * samples by least squares, so one jittery sample can't spike it. A finger
 * that stopped before lifting leaves nothing recent enough to count.
 */
export class VelocityTracker {
  private samples: { time: number; value: number }[] = [];

  /** `time` on the performance clock, as event timestamps are, in ms. */
  record(time: number, value: number) {
    const samples = this.samples;
    samples.push({ time, value });
    while (samples.length > 2 && time - samples[0]!.time > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
  }

  reset() {
    this.samples = [];
  }

  /**
   * Per ms at `now`. `toPosition` maps each recorded value first, for a
   * gesture that only knows how its samples translate once it ends.
   */
  velocity(now: number, toPosition: (value: number) => number = (v) => v) {
    const recent = this.samples
      .filter((sample) => now - sample.time <= VELOCITY_WINDOW_MS)
      .map(({ time, value }) => ({ time, position: toPosition(value) }));
    if (recent.length < 2) return 0;

    const meanTime =
      recent.reduce((sum, sample) => sum + sample.time, 0) / recent.length;
    const meanPosition =
      recent.reduce((sum, sample) => sum + sample.position, 0) / recent.length;

    let covariance = 0;
    let variance = 0;
    for (const { time, position } of recent) {
      covariance += (time - meanTime) * (position - meanPosition);
      variance += (time - meanTime) ** 2;
    }

    const speed = variance > 0 ? covariance / variance : 0;
    return Math.max(-MAX_FLING_SPEED, Math.min(MAX_FLING_SPEED, speed));
  }
}

/**
 * A sheet or picture pulled towards where it cannot go only hints at the
 * movement, following the finger at this fraction.
 */
export const PULL_AGAINST_RESISTANCE = 0.1;

/** How far a backdrop clears while what sits on it is pulled away. */
export const DISMISS_BACKDROP_FADE = 0.6;

/** The way back for a pull that was not enough, in ms. Short, because nothing changes. */
export const SNAP_BACK_MS = 200;
