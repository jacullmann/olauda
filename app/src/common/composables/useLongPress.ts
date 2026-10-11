import { onScopeDispose } from 'vue';
import { haptic } from '@/common/utils/haptics';
import { growWhilePressed, type PressGrowth } from '@/common/utils/pressGrowth';
import { HOLD_TOLERANCE } from '@/common/utils/gesture';

export type LongPressTrigger = (event: PointerEvent | MouseEvent) => void;

export interface UseLongPressOptions {
  /** Hold duration before the menu opens on touch input. */
  delay?: number;
  /** Movement in px that reinterprets the hold as a scroll and cancels it. */
  moveThreshold?: number;
  /**
   * Selector for regions that keep their own press and right-click behaviour,
   * such as a nested menu of their own or a field the caret belongs in.
   */
  ignore?: string;
  /**
   * Selector the press must land inside to count. Anything outside it — such
   * as the gaps between tiles — passes through untouched to the ancestors.
   */
  within?: string;
  /**
   * Selector, matched from the pressed element outwards, for the element that
   * swells under a touch hold until the menu opens.
   */
  grow?: string;
}

/** How long after the gesture ends a trailing compatibility click may arrive. */
const CLICK_SUPPRESS_WINDOW = 700;

/**
 * How far from the lifted finger a click may land and still be that finger's
 * own trailing click. Anything further is a new tap the user means, and
 * swallowing it makes the menu feel dead for the rest of the window.
 */
const CLICK_SUPPRESS_RADIUS = 24;

/** A takeover this soon after touch-down is not a hold, whatever caused it. */
const MIN_HOLD_BEFORE_TAKEOVER = 300;

const CAPTURE = { capture: true } as const;
const CAPTURE_ACTIVE = { capture: true, passive: false } as const;

const SELECTION_LOCK_CLASS = 'is-long-pressing';

/**
 * Holds in progress across every instance, so one lifted finger of two doesn't
 * hand selection back while the other is still down.
 */
let selectionLocks = 0;

function lockSelection() {
  selectionLocks += 1;

  if (selectionLocks === 1) {
    document.documentElement.classList.add(SELECTION_LOCK_CLASS);
  }
}

function unlockSelection() {
  if (selectionLocks === 0) return;

  selectionLocks -= 1;

  if (selectionLocks === 0) {
    document.documentElement.classList.remove(SELECTION_LOCK_CLASS);
  }
}

function isEditable(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;

  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    ),
  );
}

/**
 * A hold must never select text. `user-select` is the primary guard; this
 * covers engines that start the selection before the style applies.
 */
function preventSelectStart(event: Event) {
  if (isEditable(event.target as Node | null)) return;

  event.preventDefault();
}

/** Drops a selection that slipped through, but never a caret in a field. */
function clearStraySelection() {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) return;
  if (isEditable(selection.anchorNode)) return;

  selection.removeAllRanges();
}

/**
 * Long press that reaches Safari on iOS, where a menu bound to `contextmenu`
 * alone is unreachable: WebKit never dispatches that event for a touch hold.
 *
 * Timing the hold from `pointerdown` is only half of it. WebKit also hands the
 * touch to one of its own gesture recognisers partway through a hold and
 * answers ours with `pointercancel`/`touchcancel`, so treating a cancel as
 * "gesture aborted" — the obvious reading, and the one that works everywhere
 * else — drops the very press the user is making. A cancel is only a scroll
 * when the finger actually travelled; with the finger parked it is the
 * takeover, and we honour it as the long press instead.
 *
 * The gesture is tracked on `window` rather than on the element, so a hold
 * survives the element being re-rendered or moved underneath the finger.
 *
 * While a finger is down the whole document is made unselectable, because
 * WebKit answers a hold on unselectable content by selecting the nearest
 * selectable block around it instead.
 *
 * Targets need the `long-press-target` utility class: without
 * `-webkit-touch-callout`/`user-select` WebKit shows its own callout over the
 * menu, and without `touch-action` the lifted finger keeps Safari's
 * double-tap-zoom delay, which outlives any click-suppression window.
 */
export function useLongPress(
  trigger: LongPressTrigger,
  options: UseLongPressOptions = {},
) {
  const {
    delay = 450,
    moveThreshold = HOLD_TOLERANCE,
    ignore,
    within,
    grow,
  } = options;

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressTimer: ReturnType<typeof setTimeout> | undefined;
  let origin: { x: number; y: number } | undefined;
  let source: PointerEvent | undefined;
  let pointerId: number | undefined;
  let pointerType = '';
  let lastPoint: { x: number; y: number } | undefined;
  let suppressOrigin: { x: number; y: number } | undefined;
  let startedAt = 0;
  let travelled = false;
  let openedByHold = false;
  let tracking = false;
  let growth: PressGrowth | undefined;

  function isIgnored(event: Event) {
    const target = event.target as Element | null;

    if (within && !target?.closest?.(within)) return true;
    if (!ignore) return false;

    return Boolean(target?.closest?.(ignore));
  }

  function startGrowth(event: PointerEvent) {
    const target = grow
      ? (event.target as Element | null)?.closest?.<HTMLElement>(grow)
      : null;

    growth = target ? growWhilePressed(target, delay) : undefined;
  }

  function settleGrowth() {
    growth?.settle();
    growth = undefined;
  }

  function stopHold() {
    growth?.release();
    growth = undefined;

    if (holdTimer === undefined) return;

    clearTimeout(holdTimer);
    holdTimer = undefined;
  }

  /**
   * The compatibility click is synthesised under the finger that produced it.
   * A click that lands elsewhere belongs to a new tap, so it passes through —
   * and ends the window, because the trailing click can no longer be ahead of
   * it.
   */
  function isTrailingClick(event: MouseEvent) {
    if (!suppressOrigin) return true;

    const distance = Math.hypot(
      event.clientX - suppressOrigin.x,
      event.clientY - suppressOrigin.y,
    );

    return distance <= CLICK_SUPPRESS_RADIUS;
  }

  function swallowClick(event: MouseEvent) {
    if (isTrailingClick(event)) {
      event.preventDefault();
      event.stopPropagation();
    }

    endSuppression();
  }

  function endSuppression() {
    window.removeEventListener('click', swallowClick, CAPTURE);
    suppressOrigin = undefined;

    if (suppressTimer === undefined) return;

    clearTimeout(suppressTimer);
    suppressTimer = undefined;
  }

  /**
   * The menu is open, so the click the lifted finger still produces must reach
   * nothing: it would re-select the card underneath, or dismiss the menu by
   * landing on its own backdrop. Only that one click is blocked — `point` is
   * where the finger left the screen, and a tap anywhere else stays live while
   * the menu animates in.
   */
  function startSuppression(point: { x: number; y: number } | undefined) {
    suppressOrigin = point;
    window.addEventListener('click', swallowClick, CAPTURE);
    suppressTimer = setTimeout(endSuppression, CLICK_SUPPRESS_WINDOW);
  }

  function fire() {
    settleGrowth();
    stopHold();

    if (openedByHold || !source) return;

    openedByHold = true;
    clearStraySelection();
    haptic();
    trigger(source);
  }

  function onWindowPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId || !origin) return;

    const distance = Math.hypot(
      event.clientX - origin.x,
      event.clientY - origin.y,
    );

    lastPoint = { x: event.clientX, y: event.clientY };

    if (distance <= moveThreshold) return;

    travelled = true;
    stopHold();
  }

  function onWindowPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;

    lastPoint = { x: event.clientX, y: event.clientY };
    stopHold();

    // A touch ends on `touchend`, one event later, where the compatibility
    // click it is about to synthesise can still be cancelled.
    if (pointerType !== 'touch') stopTracking();
  }

  function onWindowPointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;

    onTakeover();
  }

  function onWindowTouchStart(event: TouchEvent) {
    // A second finger is a pinch or a two-finger scroll, never a hold.
    if (event.touches.length > 1) {
      travelled = true;
      stopHold();
    }
  }

  function onWindowTouchEnd(event: TouchEvent) {
    // Cancelling the touch's default action is what stops WebKit from
    // synthesising the trailing mouse events in the first place; the click
    // swallow below only covers browsers that synthesise them anyway.
    if (openedByHold && event.cancelable) event.preventDefault();

    if (event.touches.length === 0) stopTracking();
  }

  function onWindowTouchCancel(event: TouchEvent) {
    if (event.touches.length > 0) return;

    onTakeover();
  }

  /** The user agent claimed the gesture for a recogniser of its own. */
  function onTakeover() {
    const held = Date.now() - startedAt;
    const wasHolding =
      holdTimer !== undefined && !travelled && held >= MIN_HOLD_BEFORE_TAKEOVER;

    if (wasHolding) fire();

    stopTracking();
  }

  function onWindowScroll() {
    travelled = true;
    stopHold();
  }

  function startTracking(event: PointerEvent) {
    tracking = true;
    pointerId = event.pointerId;
    pointerType = event.pointerType;
    origin = { x: event.clientX, y: event.clientY };
    lastPoint = origin;
    source = event;
    startedAt = Date.now();
    travelled = false;

    lockSelection();
    document.addEventListener(
      'selectstart',
      preventSelectStart,
      CAPTURE_ACTIVE,
    );
    window.addEventListener('touchstart', onWindowTouchStart, CAPTURE);
    window.addEventListener('pointermove', onWindowPointerMove, CAPTURE);
    window.addEventListener('pointerup', onWindowPointerUp, CAPTURE);
    window.addEventListener('pointercancel', onWindowPointerCancel, CAPTURE);
    window.addEventListener('touchend', onWindowTouchEnd, CAPTURE_ACTIVE);
    window.addEventListener('touchcancel', onWindowTouchCancel, CAPTURE);
    window.addEventListener('scroll', onWindowScroll, CAPTURE);
  }

  function stopTracking() {
    stopHold();

    if (!tracking) return;

    const liftedAt = lastPoint ?? origin;

    tracking = false;
    pointerId = undefined;
    pointerType = '';
    origin = undefined;
    lastPoint = undefined;
    source = undefined;

    unlockSelection();
    document.removeEventListener(
      'selectstart',
      preventSelectStart,
      CAPTURE_ACTIVE,
    );
    window.removeEventListener('touchstart', onWindowTouchStart, CAPTURE);
    window.removeEventListener('pointermove', onWindowPointerMove, CAPTURE);
    window.removeEventListener('pointerup', onWindowPointerUp, CAPTURE);
    window.removeEventListener('pointercancel', onWindowPointerCancel, CAPTURE);
    window.removeEventListener('touchend', onWindowTouchEnd, CAPTURE_ACTIVE);
    window.removeEventListener('touchcancel', onWindowTouchCancel, CAPTURE);
    window.removeEventListener('scroll', onWindowScroll, CAPTURE);

    if (openedByHold) startSuppression(liftedAt);
  }

  function onPointerDown(event: PointerEvent) {
    openedByHold = false;
    stopTracking();
    endSuppression();

    if (isIgnored(event)) return;

    // A second finger is a pinch or a scroll, never a hold.
    if (!event.isPrimary) return;

    // A mouse gets its menu from the native contextmenu event.
    if (event.pointerType === 'mouse') return;

    startTracking(event);
    startGrowth(event);
    holdTimer = setTimeout(fire, delay);
  }

  function onContextMenu(event: MouseEvent) {
    if (isIgnored(event)) return;

    // Android fires this on top of the hold we already handled; iOS never
    // fires it for touch at all. Either way the native menu stays closed.
    event.preventDefault();
    event.stopPropagation();
    settleGrowth();
    stopHold();

    if (openedByHold) return;

    // It beat the hold to it, and the finger still owes a trailing click.
    if (tracking) openedByHold = true;

    trigger(event);
  }

  onScopeDispose(() => {
    stopTracking();
    endSuppression();
  });

  return {
    handlers: {
      pointerdown: onPointerDown,
      contextmenu: onContextMenu,
    },
  };
}
