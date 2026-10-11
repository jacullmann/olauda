const STAGGER_MS = 60;
/**
 * Past this many steps the rest arrive together: they start below the fold,
 * and a longer wait would read as lag rather than choreography.
 */
const MAX_STAGGER_STEPS = 8;

/** When the item at this place in the page's entrance order starts moving. */
export function entranceDelay(order: number): string {
  return `${Math.min(order, MAX_STAGGER_STEPS) * STAGGER_MS}ms`;
}

/**
 * animate-enter runs two animations of different lengths, so an element has
 * only settled once the last of its own has ended, not at the first
 * animationend. Animations of its descendants bubble up and are ignored.
 */
export function hasSettledEntrance(event: AnimationEvent): boolean {
  const element = event.currentTarget as Element;
  return (
    event.target === element &&
    !element
      .getAnimations()
      .some((animation) => animation instanceof CSSAnimation)
  );
}
