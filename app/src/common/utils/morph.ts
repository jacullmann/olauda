import { SETTLE_EASING, prefersReducedMotion } from './motion';

/** The box and corners an element grows out of, taken when it opens. */
export interface MorphOrigin {
  rect: DOMRect;
  radius: string;
}

const EXPAND_TIMING = { duration: 450, easing: SETTLE_EASING };

/**
 * Linear and apart from the expand's own curve, which covers most of its
 * distance in the first few frames.
 */
const FADE_IN_MS = 100;

/** Null under reduced motion, so the caller keeps its usual transition. */
export function morphOriginOf(el: HTMLElement | null): MorphOrigin | null {
  if (!el || prefersReducedMotion()) return null;
  return {
    rect: el.getBoundingClientRect(),
    radius: getComputedStyle(el).borderRadius,
  };
}

/**
 * Grows `el` out of `origin`: it starts centred on it, top edges aligned, and
 * clipped to its size and corners. Clipping rather than scaling keeps the
 * content at its size, so text never stretches on the way.
 */
export function expandFrom(el: HTMLElement, { rect, radius }: MorphOrigin) {
  const to = el.getBoundingClientRect();
  const dx = rect.left + rect.width / 2 - (to.left + to.width / 2);
  const dy = rect.top - to.top;
  const sideInset = Math.max(0, (to.width - rect.width) / 2);
  const bottomInset = Math.max(0, to.height - rect.height);
  const restRadius = getComputedStyle(el).borderRadius;

  el.animate([{ opacity: 0 }, { opacity: 1 }], FADE_IN_MS);
  el.animate(
    [
      {
        translate: `${dx}px ${dy}px`,
        clipPath: `inset(0px ${sideInset}px ${bottomInset}px round ${radius})`,
      },
      { translate: '0px 0px', clipPath: `inset(0px round ${restRadius})` },
    ],
    EXPAND_TIMING,
  );
}
