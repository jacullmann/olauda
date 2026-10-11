import { nextTick, onScopeDispose, readonly, ref, type Ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { haptic } from '@/common/utils/haptics';
import { growWhilePressed, type PressGrowth } from '@/common/utils/pressGrowth';
import {
  HOLD_TOLERANCE,
  rubberBand,
  SCROLL_EDGE_STIFFNESS,
  VelocityTracker,
} from '@/common/utils/gesture';
import { Spring, type SpringConfig } from '@/common/utils/spring';

export interface DragReorderOptions {
  /** Called with DOM indices once a card is released in a new slot. */
  onMove: (from: number, to: number) => void;
  /** Presses on these keep their own behaviour and never pick a card up. */
  ignore?: string;
  /** How long a finger has to rest on a card before it lifts. */
  holdDelay?: number;
}

/** Marks the direct children of the list that can be picked up. */
export const REORDER_ITEM_ATTR = 'data-reorder-item';

/** Neighbours sliding out of the way. */
const SHIFT: SpringConfig = { response: 0.36, dampingRatio: 0.86 };
/** A released card gliding into its slot, carrying the speed of the fling. */
const SETTLE: SpringConfig = { response: 0.42, dampingRatio: 0.8 };
/** The pick-up: a quick swell that pops just past its size. */
const LIFT: SpringConfig = { response: 0.24, dampingRatio: 0.6 };
/** Setting the card down, without bouncing back up. */
const LOWER: SpringConfig = { response: 0.3, dampingRatio: 1 };
/** The rest of the list stepping back while a card is held, and returning. */
const RECEDE: SpringConfig = { response: 0.34, dampingRatio: 1 };

const LIFT_SCALE = 0.03;
const RECEDE_SCALE = 0.015;
const MOUSE_DRAG_THRESHOLD = 4;
const AUTOSCROLL_EDGE = 72;
const AUTOSCROLL_MAX_SPEED = 1100;
/** How far a held card gives way past the ends of the list, and sideways, in px. */
const OVERDRAG_LIMIT_Y = 48;
const OVERDRAG_LIMIT_X = 20;
/** Lift and recede run from 0 to 1, so they rest far closer than pixels do. */
const SCALAR_REST = 0.001;

interface Entry {
  el: HTMLElement;
  x: Spring;
  y: Spring;
  lift: Spring;
  /** How far the card has stepped back behind the one being held. */
  recede: Spring;
  /** Stays above its neighbours until it has fully landed. */
  raised: boolean;
}

interface Slot {
  entry: Entry;
  top: number;
  height: number;
}

interface Pending {
  el: HTMLElement;
  pointerType: 'mouse' | 'touch';
  id: number;
  startX: number;
  startY: number;
  timer?: ReturnType<typeof setTimeout>;
  /** The swell under a resting finger, which the lift carries on from. */
  growth?: PressGrowth;
}

interface Gesture {
  entry: Entry;
  pointerType: 'mouse' | 'touch';
  /** The pointer or finger that owns the card. */
  id: number;
  startX: number;
  startY: number;
  scrollStart: number;
  baseY: number;
  from: number;
  to: number;
  slots: Slot[];
  gap: number;
  minY: number;
  maxY: number;
  tracker: VelocityTracker;
}

function overdrag(distance: number, limit: number) {
  return rubberBand(distance, limit, SCROLL_EDGE_STIFFNESS);
}

function findScroller(el: HTMLElement): HTMLElement {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * Reordering a vertical list by picking a card up and moving it, built to feel
 * like handling an object rather than operating a widget.
 *
 * The card sticks to the pointer 1:1 and never lags behind it. Everything else
 * is driven by springs that keep their velocity when retargeted, so neighbours
 * that change their mind mid-slide turn around smoothly instead of restarting
 * a curve, and a card that is flicked keeps its momentum into the slot it
 * lands in. The data is committed the moment the card is released; each card
 * is then offset back to where it was on screen and springs home, so the
 * reorder itself is never visible as a jump.
 *
 * The cards are the elements carrying `data-reorder-item`, which must be direct
 * children of the container and match the order of the rendered list.
 */
export function useDragReorder(
  container: Ref<HTMLElement | null>,
  options: DragReorderOptions,
) {
  const { onMove, ignore, holdDelay = 320 } = options;

  const entries = new Map<HTMLElement, Entry>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let pending: Pending | null = null;
  let gesture: Gesture | null = null;
  /** A held card's finger must not also swipe it aside. */
  const isDragging = ref(false);
  let pointerX = 0;
  let pointerY = 0;
  let scroller: HTMLElement | null = null;
  let frameId = 0;
  let lastFrame = 0;

  function items(): HTMLElement[] {
    const root = container.value;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(`:scope > [${REORDER_ITEM_ATTR}]`),
    );
  }

  function entryFor(el: HTMLElement): Entry {
    let entry = entries.get(el);
    if (!entry) {
      entry = {
        el,
        x: new Spring(SETTLE),
        y: new Spring(SHIFT),
        lift: new Spring(LIFT, SCALAR_REST),
        recede: new Spring(RECEDE, SCALAR_REST),
        raised: false,
      };
      entries.set(el, entry);
    }
    return entry;
  }

  function scrollTop() {
    return scroller?.scrollTop ?? 0;
  }

  function schedule() {
    if (frameId) return;
    lastFrame = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    frameId = 0;
    const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
    lastFrame = now;

    if (gesture) track(dt, now);

    let moving = !!gesture;

    for (const entry of entries.values()) {
      const held = gesture?.entry === entry;
      const springs = held
        ? [entry.lift]
        : [entry.x, entry.y, entry.lift, entry.recede];

      for (const spring of springs) {
        if (reducedMotion.matches) spring.jump(spring.target);
        else spring.settle(now);
      }

      if (render(entry, held, now)) moving = true;
    }

    if (moving) {
      lastFrame = now;
      frameId = requestAnimationFrame(frame);
    }
  }

  /** Paints one card, and reports whether it still has somewhere to go. */
  function render(entry: Entry, held: boolean, now: number): boolean {
    const { el } = entry;
    const atRest =
      !held &&
      [entry.x, entry.y, entry.lift, entry.recede].every(
        (spring) => spring.resting && spring.target === 0,
      );

    if (atRest) {
      // A lingering transform would make every card its own stacking context
      // and trap the menus rendered inside it.
      el.style.transform = '';
      el.style.zIndex = '';
      el.style.removeProperty('--lift');
      el.style.removeProperty('--recede');
      el.classList.remove('is-lifted');
      entry.raised = false;
      // A gesture still holds on to its neighbours' springs.
      if (!gesture) entries.delete(el);
      return false;
    }

    const [x] = entry.x.sample(now);
    const [y] = entry.y.sample(now);
    const [lift] = entry.lift.sample(now);
    const [recede] = entry.recede.sample(now);
    const amount = Math.max(0, lift);
    const scale = 1 + lift * LIFT_SCALE - recede * RECEDE_SCALE;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    el.style.setProperty('--recede', Math.max(0, recede).toFixed(3));

    if (entry.raised) {
      // A card still landing from the last drop stays above its neighbours,
      // but never above the one in hand.
      el.style.zIndex = held ? '51' : '50';
      el.style.setProperty('--lift', Math.min(1, amount).toFixed(3));
      el.classList.add('is-lifted');
    }

    return true;
  }

  /** Follows the pointer, decides the slot under the card, and edge-scrolls. */
  function track(dt: number, now: number) {
    const g = gesture!;
    const dx = pointerX - g.startX;
    let y = g.baseY + (pointerY - g.startY) + (scrollTop() - g.scrollStart);

    if (y < g.minY) {
      y = g.minY - overdrag(g.minY - y, OVERDRAG_LIMIT_Y);
    } else if (y > g.maxY) {
      y = g.maxY + overdrag(y - g.maxY, OVERDRAG_LIMIT_Y);
    }

    g.entry.x.jump(overdrag(dx, OVERDRAG_LIMIT_X));
    g.entry.y.jump(y);
    g.tracker.record(now, y);

    const self = g.slots[g.from]!;
    const top = self.top + y;
    const bottom = top + self.height;
    const room = self.height + g.gap;
    let to = g.from;

    g.slots.forEach((slot, index) => {
      if (index === g.from) return;
      const middle = slot.top + slot.height / 2;
      let target = 0;
      if (index > g.from && bottom > middle) {
        target = -room;
        to++;
      } else if (index < g.from && top < middle) {
        target = room;
        to--;
      }
      slot.entry.y.retarget(target, now);
    });

    g.to = to;

    autoscroll(dt);
  }

  function autoscroll(dt: number) {
    if (!scroller) return;

    const isPage = scroller === document.scrollingElement;
    const rect = isPage
      ? { top: 0, bottom: window.innerHeight }
      : scroller.getBoundingClientRect();

    let direction = 0;
    let closeness = 0;
    if (pointerY < rect.top + AUTOSCROLL_EDGE) {
      direction = -1;
      closeness = (rect.top + AUTOSCROLL_EDGE - pointerY) / AUTOSCROLL_EDGE;
    } else if (pointerY > rect.bottom - AUTOSCROLL_EDGE) {
      direction = 1;
      closeness =
        (pointerY - (rect.bottom - AUTOSCROLL_EDGE)) / AUTOSCROLL_EDGE;
    }
    if (!direction) return;

    const eased = Math.min(1, closeness) ** 2;
    scroller.scrollTop += direction * eased * AUTOSCROLL_MAX_SPEED * dt;
  }

  function lift(from: Pending) {
    const els = items();
    const index = els.indexOf(from.el);
    const root = container.value;
    if (index === -1 || !root) return;

    scroller = findScroller(root);

    const slots: Slot[] = els.map((el) => ({
      entry: entryFor(el),
      top: el.offsetTop,
      height: el.offsetHeight,
    }));
    const self = slots[index]!;
    const first = slots[0]!;
    const last = slots[slots.length - 1]!;

    const entry = self.entry;
    const now = performance.now();
    const grown = from.growth?.handOver() ?? 1;
    entry.raised = true;
    const [lifted, liftSpeed] = entry.lift.sample(now);
    const liftFrom = lifted + (grown - 1) / LIFT_SCALE;
    entry.lift.launch(liftFrom, liftSpeed, 1, now, LIFT);
    for (const slot of slots) {
      if (slot === self) continue;
      slot.entry.y.retarget(slot.entry.y.target, now, SHIFT);
      slot.entry.recede.retarget(1, now);
    }

    gesture = {
      entry,
      pointerType: from.pointerType,
      id: from.id,
      startX: from.startX,
      startY: from.startY,
      scrollStart: scrollTop(),
      // A card grabbed while still sliding is picked up where it is.
      baseY: entry.y.sample(now)[0],
      from: index,
      to: index,
      slots,
      gap: parseFloat(getComputedStyle(root).rowGap) || 0,
      minY: first.top - self.top,
      maxY: last.top + last.height - (self.top + self.height),
      tracker: new VelocityTracker(),
    };
    pending = null;
    isDragging.value = true;

    document.documentElement.classList.add('is-reordering');
    window.getSelection()?.removeAllRanges();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);

    if (from.pointerType === 'touch') haptic(8);

    // Painted now rather than on the next frame, so the card never drops back
    // to rest between the growth handing over and the lift taking it.
    render(entry, true, now);
    schedule();
  }

  function release(cancelled: boolean) {
    const g = gesture;
    if (!g) return;
    gesture = null;
    isDragging.value = false;

    document.documentElement.classList.remove('is-reordering');
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('blur', onBlur);

    const { entry } = g;
    const now = performance.now();
    const velocity = cancelled ? 0 : g.tracker.velocity(now) * 1000;
    const [y] = entry.y.sample(now);

    entry.x.retarget(0, now, SETTLE);
    entry.y.launch(y, velocity, y, now, SETTLE);
    entry.lift.retarget(0, now, LOWER);
    for (const slot of g.slots) slot.entry.recede.retarget(0, now);

    const to = cancelled ? g.from : g.to;
    const stillInPlace = items()[g.from] === entry.el;

    if (to === g.from || !stillInPlace) {
      for (const slot of g.slots) slot.entry.y.retarget(0, now);
      schedule();
      return;
    }

    void commit(g.from, to);
  }

  /**
   * Hands the new order to the data and lets Vue move the nodes, then offsets
   * every card back to where it was on screen so the springs carry it the rest
   * of the way. Runs within one task, so the reordered layout is never painted
   * without its offsets.
   */
  async function commit(from: number, to: number) {
    const before = new Map<HTMLElement, number>();
    const drawnAt = performance.now();
    for (const el of items()) {
      const shift = entries.get(el)?.y.sample(drawnAt)[0] ?? 0;
      before.set(el, el.offsetTop + shift);
    }

    onMove(from, to);
    await nextTick();

    const now = performance.now();
    for (const el of items()) {
      const visual = before.get(el);
      if (visual === undefined) continue;
      const offset = visual - el.offsetTop;
      const entry = entries.get(el);
      if (!entry && Math.abs(offset) < 0.5) continue;
      const spring = (entry ?? entryFor(el)).y;
      // Keeps the speed a flicked card was released at.
      const [, velocity] = spring.sample(now);
      spring.launch(offset, velocity, 0, now);
    }

    schedule();
  }

  /** Moves a card without a gesture, with the same motion as dropping it. */
  function move(from: number, to: number) {
    if (from === to || gesture) return;
    void commit(from, to);
  }

  function cancelPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.growth?.release();
    pending = null;
  }

  function pressedItem(event: Event): HTMLElement | null {
    const target = event.target as Element | null;
    if (!target || (ignore && target.closest(ignore))) return null;
    const item = target.closest<HTMLElement>(`[${REORDER_ITEM_ATTR}]`);
    return item && item.parentElement === container.value ? item : null;
  }

  // ─── Mouse and pen: picked up as soon as the pointer travels ────────────

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    if (gesture || pending) return;

    const el = pressedItem(event);
    if (!el) return;

    pending = {
      el,
      pointerType: 'mouse',
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    pointerX = event.clientX;
    pointerY = event.clientY;

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== (gesture ? gesture.id : pending?.id)) return;

    pointerX = event.clientX;
    pointerY = event.clientY;

    if (pending) {
      const travelled = Math.hypot(
        pointerX - pending.startX,
        pointerY - pending.startY,
      );
      if (travelled > MOUSE_DRAG_THRESHOLD) lift(pending);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== (gesture ? gesture.id : pending?.id)) return;

    stopMouseTracking();

    if (gesture?.pointerType === 'mouse') {
      // The click that ends a drag must not land on the card as a tap.
      window.addEventListener('click', swallowClick, true);
      setTimeout(
        () => window.removeEventListener('click', swallowClick, true),
        0,
      );
      release(false);
    }
    cancelPending();
  }

  function stopMouseTracking() {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
  }

  function swallowClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener('click', swallowClick, true);
  }

  // ─── Touch: picked up by resting a finger, so the list still scrolls ────

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length > 1) {
      cancelPending();
      return;
    }
    if (gesture || pending) return;

    const el = pressedItem(event);
    const touch = event.changedTouches[0];
    if (!el || !touch) return;

    pending = {
      el,
      pointerType: 'touch',
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      growth: growWhilePressed(el, holdDelay),
    };
    pointerX = touch.clientX;
    pointerY = touch.clientY;
    pending.timer = setTimeout(() => pending && lift(pending), holdDelay);

    // Registered as non-passive so a lifted card can stop the page scrolling;
    // until the hold completes, nothing is cancelled and the list scrolls.
    window.addEventListener('touchmove', onTouchMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener('touchend', onTouchEnd, {
      capture: true,
      passive: false,
    });
    window.addEventListener('touchcancel', onTouchEnd, true);
    window.addEventListener('scroll', onScrollWhilePending, true);
  }

  function touchOf(event: TouchEvent, id: number) {
    return Array.from(event.changedTouches).find((t) => t.identifier === id);
  }

  function onTouchMove(event: TouchEvent) {
    const id = gesture ? gesture.id : pending?.id;
    const touch = id === undefined ? undefined : touchOf(event, id);
    if (!touch) return;

    pointerX = touch.clientX;
    pointerY = touch.clientY;

    if (gesture) {
      if (event.cancelable) event.preventDefault();
      return;
    }

    if (
      pending &&
      Math.hypot(pointerX - pending.startX, pointerY - pending.startY) >
        HOLD_TOLERANCE
    ) {
      stopTouchTracking();
    }
  }

  function onTouchEnd(event: TouchEvent) {
    const id = gesture ? gesture.id : pending?.id;
    if (id === undefined || !touchOf(event, id)) return;

    if (gesture && event.cancelable) event.preventDefault();

    release(false);
    stopTouchTracking();
  }

  function onScrollWhilePending() {
    if (pending && !gesture) stopTouchTracking();
  }

  function stopTouchTracking() {
    cancelPending();
    window.removeEventListener('touchmove', onTouchMove, true);
    window.removeEventListener('touchend', onTouchEnd, true);
    window.removeEventListener('touchcancel', onTouchEnd, true);
    window.removeEventListener('scroll', onScrollWhilePending, true);
  }

  /** A hold that became a drag is not also a request for the card's menu. */
  function onContextMenu(event: MouseEvent) {
    if (gesture?.pointerType === 'touch' || pending?.pointerType === 'touch') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    release(true);
  }

  function onBlur() {
    release(false);
    stopTouchTracking();
    stopMouseTracking();
  }

  useEventListener(container, 'pointerdown', onPointerDown);
  useEventListener(container, 'touchstart', onTouchStart, { passive: true });
  useEventListener(container, 'contextmenu', onContextMenu, true);

  onScopeDispose(() => {
    release(true);
    stopTouchTracking();
    stopMouseTracking();
    if (frameId) cancelAnimationFrame(frameId);
    for (const { el } of entries.values()) {
      el.style.transform = '';
      el.style.zIndex = '';
      el.style.removeProperty('--lift');
      el.style.removeProperty('--recede');
      el.classList.remove('is-lifted');
    }
    entries.clear();
  });

  return { move, isDragging: readonly(isDragging) };
}
