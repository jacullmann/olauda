import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import {
  useSwipeToDismiss,
  SWIPE_SETTLE_MS,
  SWIPE_SETTLE_EASING,
} from './useSwipeToDismiss';

/** What a swipe button does. A full swipe runs the main one, shown across the whole strip past the commit point. */
export type SwipeAction =
  | 'archive'
  | 'keep'
  | 'delete'
  | 'edit'
  | 'duplicate'
  | 'pin'
  | 'unpin'
  | 'menu';

/** An icon-only `BaseButton` at its default size (`size-10`). */
export const SWIPE_BUTTON_SIZE = 40;
/** Between the buttons and around them, as with Tailwind's `gap-2`. */
export const SWIPE_BUTTON_GAP = 8;

function restWidth(buttonCount: number) {
  return buttonCount * SWIPE_BUTTON_SIZE + (buttonCount + 1) * SWIPE_BUTTON_GAP;
}

/** Settles the card and its buttons together. */
export const SWIPE_SETTLE_TIMING = `${SWIPE_SETTLE_MS}ms ${SWIPE_SETTLE_EASING}`;

const FOCUS_TIMING = 'var(--duration-focus) var(--ease-focus)';

export interface SwipeCardOptions {
  enabled: MaybeRefOrGetter<boolean>;
  /** Whether the right-hand buttons come in a pair. */
  hasSecondaryAction: MaybeRefOrGetter<boolean>;
  /** Whether swiping right reveals a single action. */
  hasStartAction: MaybeRefOrGetter<boolean>;
  /** Runs when a swipe to the right goes all the way, with the card sliding back. */
  onStartCommit: () => void;
  confirmDismiss?: () => Promise<boolean>;
  /** Runs once the card has slid out; closing the gap it leaves is up to the list. */
  onDismissed: () => void;
}

/**
 * A card that slides aside onto action buttons behind it, on either side. The card moves by
 * `cardStyle`; a full swipe slides it out and then calls `onDismissed`.
 */
export function useSwipeCard(
  card: Ref<HTMLElement | null>,
  tray: Readonly<Ref<HTMLElement | null>>,
  options: SwipeCardOptions,
) {
  const swipe = useSwipeToDismiss(card, {
    enabled: options.enabled,
    revealWidth: () => restWidth(toValue(options.hasSecondaryAction) ? 2 : 1),
    startRevealWidth: () =>
      toValue(options.hasStartAction) ? restWidth(1) : 0,
    actions: tray,
    confirmDismiss: options.confirmDismiss,
    onSlideOut: options.onDismissed,
    onStartCommit: options.onStartCommit,
  });

  const cardStyle = computed(() => {
    if (!swipe.isActionsVisible.value) return undefined;
    return {
      // Eased frame by frame together with the buttons, never transitioned.
      transform: `translateX(${-swipe.animatedOffset.value}px)`,
      // The corners round off on the settle clock even mid-drag. An inline
      // `transition` replaces the card's class-based one, so the focus and
      // hover properties are repeated here.
      transition: `border-radius ${SWIPE_SETTLE_TIMING}, box-shadow ${SWIPE_SETTLE_TIMING}, outline-color ${FOCUS_TIMING}, background-color ${FOCUS_TIMING}`,
    };
  });

  /** Cards flush with the screen edge round their corners once pulled aside. */
  const isRevealed = computed(
    () => swipe.swipeOffset.value !== 0 || swipe.isSwiping.value,
  );

  /** How far the card is drawn aside, whichever way. */
  const revealedOffset = computed(() => Math.abs(swipe.animatedOffset.value));

  /** Past the commit point the main action takes over the whole strip. */
  const isTakingOver = computed(() =>
    swipe.activeSide.value === 'right'
      ? swipe.isArmed.value || swipe.isDismissing.value
      : swipe.isStartArmed.value,
  );

  return { ...swipe, cardStyle, isRevealed, isTakingOver, revealedOffset };
}
