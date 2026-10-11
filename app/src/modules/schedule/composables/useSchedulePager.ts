import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core';
import {
  EDGE_RESISTANCE,
  FLICK_VELOCITY,
  lockAxis,
  PAGE_COMMIT_FRACTION,
  VelocityTracker,
} from '@/common/utils/gesture';
import { haptic } from '@/common/utils/haptics';

/**
 * Space between the page on screen and the one sliding in, in px: the page's
 * 16px gutter on both sides, so each page slides as if it carried its padding.
 */
const PAGE_GAP = 32;

type Direction = 1 | -1;

export type SchedulePager = ReturnType<typeof useSchedulePager>;

/**
 * Pages through a schedule by swiping or picking a page. With a page count,
 * the pages run from 0 to one short of it and a pull past either end gives;
 * without one, every page has a neighbour on both sides.
 */
export function useSchedulePager(pageCount?: number) {
  const trackRef = shallowRef<HTMLElement | null>(null);
  const reducedMotion = usePreferredReducedMotion();

  const activePage = ref(0);
  const selectedPage = ref(0);
  const incomingPage = ref<number | null>(null);
  const offset = ref(0);
  const settling = ref(false);
  const hasPaged = ref(false);

  watch(incomingPage, (page) => {
    if (page !== null) hasPaged.value = true;
  });

  /** How far the incoming page sits below the top of the track, in px. */
  const incomingDrop = ref(0);

  const panelOf = (page: number) =>
    trackRef.value?.querySelector<HTMLElement>(
      `:scope > [data-page="${page}"]`,
    );

  /*
   * A shorter page swiped in from far down a longer one would start at the
   * top of the track, out of view, and leave the window scrolled past its end
   * once it settles. It drops instead to the top of the view, kept within the
   * track, and at least as far as the window could no longer stay scrolled;
   * the window scrolls back by as much as it turns, so the page stays put.
   */
  const dropIntoView = (page: number) => {
    const track = trackRef.value;
    const active = panelOf(activePage.value);
    const incoming = panelOf(page);
    if (!track || !active || !incoming) return 0;
    const viewTop =
      parseFloat(getComputedStyle(track).getPropertyValue('--header-height')) ||
      0;
    const scrolledPast = viewTop - track.getBoundingClientRect().top;
    const scrollLeft =
      document.documentElement.scrollHeight -
      window.innerHeight -
      window.scrollY;
    const room = active.offsetHeight - incoming.offsetHeight;
    if (room <= 0) return 0;
    return Math.min(room, Math.max(0, scrolledPast, room - scrollLeft));
  };

  watch(
    incomingPage,
    (page) => {
      incomingDrop.value = page === null ? 0 : dropIntoView(page);
    },
    { flush: 'post' },
  );

  let onSettled: (() => void) | null = null;

  const direction = computed<Direction>(() =>
    incomingPage.value !== null && incomingPage.value < activePage.value
      ? -1
      : 1,
  );

  const exists = (page: number) =>
    pageCount === undefined || (page >= 0 && page < pageCount);

  const pageWidth = () => (trackRef.value?.clientWidth ?? 0) + PAGE_GAP;

  const finishSettling = () => {
    settling.value = false;
    const done = onSettled;
    onSettled = null;
    done?.();
  };

  const settleTo = (target: number, done: () => void) => {
    if (reducedMotion.value === 'reduce' || offset.value === target) {
      offset.value = target;
      done();
      return;
    }
    onSettled = done;
    settling.value = true;
    offset.value = target;
  };

  const commitIncoming = () => {
    if (incomingPage.value !== null) {
      activePage.value = incomingPage.value;
    }
    if (incomingDrop.value > 0) {
      window.scrollBy({ top: -incomingDrop.value, behavior: 'instant' });
    }
    incomingPage.value = null;
    offset.value = 0;
  };

  const turnPage = () => {
    selectedPage.value = incomingPage.value ?? activePage.value;
    settleTo(-direction.value * pageWidth(), commitIncoming);
  };

  const cancelPage = () => {
    settleTo(0, () => {
      incomingPage.value = null;
    });
  };

  const showPage = (page: number) => {
    if (settling.value) finishSettling();
    incomingPage.value = null;
    offset.value = 0;
    activePage.value = page;
    selectedPage.value = page;
  };

  /** Shows a page outright, as paged to rather than as the first one shown. */
  const skipToPage = (page: number) => {
    hasPaged.value = true;
    showPage(page);
  };

  const goToPage = async (page: number) => {
    if (settling.value) finishSettling();
    if (page === activePage.value) return;
    if (reducedMotion.value === 'reduce') {
      showPage(page);
      return;
    }

    incomingPage.value = page;
    selectedPage.value = page;
    await nextTick();
    // Lays the incoming page out beside this one before the slide starts.
    void trackRef.value?.offsetWidth;
    turnPage();
  };

  const onPanelTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== 'transform' || !settling.value) return;
    finishSettling();
  };

  let startX = 0;
  let startY = 0;
  let axis: 'x' | 'y' | null = null;
  const tracker = new VelocityTracker();

  useEventListener(
    trackRef,
    'touchstart',
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      if (settling.value) finishSettling();
      startX = touch.clientX;
      startY = touch.clientY;
      tracker.reset();
      tracker.record(event.timeStamp, touch.clientX);
      axis = null;
    },
    { passive: true },
  );

  useEventListener(
    trackRef,
    'touchmove',
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || axis === 'y') return;

      const dx = touch.clientX - startX;
      if (axis === null) {
        const dy = touch.clientY - startY;
        axis = lockAxis(dx, dy);
        if (axis !== 'x') return;
      }

      event.preventDefault();
      tracker.record(event.timeStamp, touch.clientX);

      const neighbour = activePage.value - Math.sign(dx);
      const hasNeighbour = dx !== 0 && exists(neighbour);
      incomingPage.value = hasNeighbour ? neighbour : null;
      offset.value = hasNeighbour ? dx : dx * EDGE_RESISTANCE;
    },
    { passive: false },
  );

  const endSwipe = (event: TouchEvent, cancelled: boolean) => {
    if (axis !== 'x') return;
    axis = null;

    const velocity = tracker.velocity(event.timeStamp);
    const flicked =
      Math.abs(velocity) > FLICK_VELOCITY &&
      Math.sign(velocity) === Math.sign(offset.value);
    const farEnough =
      Math.abs(offset.value) > pageWidth() * PAGE_COMMIT_FRACTION;

    if (!cancelled && incomingPage.value !== null && (flicked || farEnough)) {
      haptic();
      turnPage();
    } else {
      cancelPage();
    }
  };

  useEventListener(trackRef, 'touchend', (e) => endSwipe(e, false), {
    passive: true,
  });
  useEventListener(trackRef, 'touchcancel', (e) => endSwipe(e, true), {
    passive: true,
  });

  const panelStyle = (page: number) => {
    if (page === activePage.value) {
      return { transform: `translateX(${offset.value}px)` };
    }
    const shift = `calc(${offset.value}px + ${direction.value * 100}% + ${direction.value * PAGE_GAP}px)`;
    return { transform: `translate(${shift}, ${incomingDrop.value}px)` };
  };

  return {
    trackRef,
    pageCount,
    activePage,
    selectedPage,
    incomingPage,
    settling,
    hasPaged,
    goToPage,
    showPage,
    skipToPage,
    panelStyle,
    onPanelTransitionEnd,
  };
}
