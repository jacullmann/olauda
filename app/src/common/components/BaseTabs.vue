<script lang="ts">
import type { Component } from 'vue';
import {
  lockAxis,
  MAX_FLING_SPEED,
  rubberBand,
  SCROLL_EDGE_STIFFNESS,
  VelocityTracker,
} from '@/common/utils/gesture';
import { Spring, type SpringConfig } from '@/common/utils/spring';
import { haptic } from '@/common/utils/haptics';

export interface NavItem {
  id: string;
  label: string;
  icon?: Component;
}

/**
 * `segmented` is an inline control sized to its labels. `tab-bar` is an app's
 * bottom navigation: tabs that share the width equally, as far as their labels
 * allow, with a large icon over a small label.
 */
export type TabsVariant = 'segmented' | 'tab-bar';

/** Tapping or arrowing to a tab: straight there, without overshooting. */
const SELECT: SpringConfig = { response: 0.34, dampingRatio: 1 };
/** Letting go of the pill, which carries the speed it was thrown with. */
const RELEASE: SpringConfig = { response: 0.36, dampingRatio: 0.88 };
/** The pill gliding over to a finger that picked it up from another tab. */
const CATCH_UP: SpringConfig = { response: 0.28, dampingRatio: 1 };
/** The pill giving way under a finger that holds it. */
const PRESS: SpringConfig = { response: 0.22, dampingRatio: 1 };

/** How far the held pill draws in from every side, in px. */
const PRESS_INSET = 2;
/**
 * The room the pill leaves either side of a label, in px, reaching over onto
 * the neighbouring tabs where they sit closer than that. It matches a segmented
 * control's outer padding, so at the row's ends the pill meets the wall.
 */
const PILL_PADDING = 20;
/** The least the pill keeps clear of a neighbouring label, in px, giving up padding for it. */
const LABEL_CLEARANCE = 6;
/**
 * How far ahead a release's momentum is projected when picking the tab it
 * lands on, in seconds: the reach of UIScrollView's fast deceleration.
 */
const PROJECTION = 0.1;
/** The most the pill can be pushed past the first or last tab, in px. */
const OVERDRAG_LIMIT = 12;
const AUTOSCROLL_EDGE = 40;
const AUTOSCROLL_SPEED = 900;
/** How long after a drag the click its pointer may still produce is swallowed. */
const CLICK_SUPPRESS_WINDOW = 400;

const CAPTURE = { capture: true } as const;
const CAPTURE_ACTIVE = { capture: true, passive: false } as const;

/** Where the pill sits on each tab along the row, in layout px. */
interface Metrics {
  lefts: number[];
  rights: number[];
  centers: number[];
  /** How far each tab's contents move from where layout puts them to sit centred in the pill. */
  contentShifts: number[];
  /** The row's height: the narrowest the pill is ever squeezed to. */
  height: number;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  /** Whether every touch move is the pill's; until then a vertical pan can still scroll the page. */
  claimed: boolean;
  /** The point on every tab that the finger holds the pill by, as a distance along the row. */
  stops: number[];
  /** How far the pill still trails the finger, closing as it catches up. */
  lag: Spring;
  tracker: VelocityTracker;
  /** Where the row is being scrolled to, kept fractional. */
  scroll: number;
  /** The tab the held pill sits nearest, so passing onto another one ticks. */
  nearestTab: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * How far along the ascending `stops` the value `x` lies, counted in stops:
 * 1.5 is halfway between the second and the third. Past either end the
 * nearest segment carries on.
 */
function progressAlong(stops: readonly number[], x: number) {
  const last = stops.length - 1;
  if (last < 1) return 0;

  let index = 0;
  while (index < last - 1 && x >= stops[index + 1]!) index++;

  const from = stops[index]!;
  return index + (x - from) / (stops[index + 1]! - from);
}

/** The value `progress` stops along the ascending `stops`; undoes `progressAlong`. */
function valueAlong(stops: readonly number[], progress: number) {
  const last = stops.length - 1;
  if (last < 1) return stops[0] ?? 0;

  const index = clamp(Math.floor(progress), 0, last - 1);
  const from = stops[index]!;
  return from + (stops[index + 1]! - from) * (progress - index);
}

/** Keeps a pill centre over the tabs, giving way ever more reluctantly past the ends. */
function resist(metrics: Metrics, center: number) {
  const first = metrics.centers[0]!;
  const last = metrics.centers[metrics.centers.length - 1]!;

  if (center < first)
    return (
      first - rubberBand(first - center, OVERDRAG_LIMIT, SCROLL_EDGE_STIFFNESS)
    );
  if (center > last)
    return (
      last + rubberBand(center - last, OVERDRAG_LIMIT, SCROLL_EDGE_STIFFNESS)
    );
  return center;
}

/**
 * The pill's edges for a centre anywhere along the row. Between two tabs both
 * edges travel in step from one tab's edges to the other's, so the pill
 * reshapes continuously on its way. Pushed past the first or last tab, its
 * outer edge stays against the wall and the pill is squeezed instead.
 */
function pillEdges(metrics: Metrics, center: number): [number, number] {
  const { lefts, rights, centers, height } = metrics;
  const last = centers.length - 1;
  const first = centers[0]!;
  const final = centers[last]!;

  if (center < first) {
    const left = lefts[0]!;
    const right = rights[0]!;
    const narrowest = Math.min(height, right - left);
    return [left, Math.max(right - 2 * (first - center), left + narrowest)];
  }

  if (center > final) {
    const left = lefts[last]!;
    const right = rights[last]!;
    const narrowest = Math.min(height, right - left);
    return [Math.min(left + 2 * (center - final), right - narrowest), right];
  }

  const progress = progressAlong(centers, center);
  return [valueAlong(lefts, progress), valueAlong(rights, progress)];
}

/**
 * The tab under `x`, or the nearest one past either end. Neighbouring pill
 * shapes overlap, so two tabs part halfway through the overlap.
 */
function tabAt(metrics: Metrics, x: number) {
  const { lefts, rights } = metrics;
  const index = rights.findIndex(
    (right, i) => x < (right + (lefts[i + 1] ?? right)) / 2,
  );
  return index === -1 ? rights.length - 1 : index;
}

/**
 * The tab a released pill lands on: the one nearest to where its momentum
 * would carry it, but never more than one past the tab it was let go over.
 */
function landingIndex(metrics: Metrics, center: number, speed: number) {
  const last = metrics.centers.length - 1;
  const here = nearestTab(metrics, center);
  const ahead = Math.round(
    progressAlong(metrics.centers, center + speed * PROJECTION),
  );

  return clamp(ahead, Math.max(here - 1, 0), Math.min(here + 1, last));
}

/** The tab whose centre is closest to a pill centre. */
function nearestTab(metrics: Metrics, center: number) {
  return clamp(
    Math.round(progressAlong(metrics.centers, center)),
    0,
    metrics.centers.length - 1,
  );
}

/** How much `el` is drawn scaled by the transforms around it; 1 when barely at all. */
function drawnScale(el: HTMLElement, rect = el.getBoundingClientRect()) {
  const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
  return Math.abs(scale - 1) < 0.01 ? 1 : scale;
}

/** A length for inline CSS, rounded so it never serialises in exponent notation. */
function px(value: number) {
  return `${Math.round(value * 100) / 100}px`;
}

const SOLID = 'linear-gradient(#000 0 0)';
const ROUND =
  'radial-gradient(closest-side, #000 calc(100% - 0.5px), transparent calc(100% + 0.5px))';

/**
 * A mask for everything outside the pill: the whole row, less the pill's two
 * round ends and the two bars joining them, one of which is always empty.
 * Masks leave hit testing alone, unlike a clip, so every tab stays pressable.
 */
function outsidePill(left: number, top: number, width: number, height: number) {
  const radius = Math.min(width, height) / 2;
  const diameter = 2 * radius;
  const layer = (image: string, x: number, y: number, w: number, h: number) =>
    `${image} ${px(x)} ${px(y)} / ${px(w)} ${px(h)} no-repeat add`;

  return [
    `${SOLID} 0 0 / 100% 100% no-repeat subtract`,
    layer(ROUND, left, top, diameter, diameter),
    layer(
      ROUND,
      left + width - diameter,
      top + height - diameter,
      diameter,
      diameter,
    ),
    layer(SOLID, left + radius, top, width - diameter, height),
    layer(SOLID, left, top + radius, width, height - diameter),
  ].join(', ');
}
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    items: NavItem[];
    activeId: string;
    variant?: TabsVariant;
  }>(),
  {
    items: () => [],
    activeId: '',
    variant: 'segmented',
  },
);

const emit = defineEmits<{
  (e: 'change', id: string): void;
}>();

const groupName = useId();
const reducedMotion = usePreferredReducedMotion();

const containerRef = ref<HTMLElement | null>(null);
const barRef = ref<HTMLElement | null>(null);
const rowRef = ref<HTMLElement | null>(null);
const tabsRef = ref<HTMLElement | null>(null);
const pillRef = ref<HTMLElement | null>(null);

const isStretched = ref(false);
const isScrollable = ref(false);
const isDragging = ref(false);

const isTabBar = computed(() => props.variant === 'tab-bar');
const fillsWidth = computed(() => isTabBar.value || isStretched.value);

const activeIndex = computed(() =>
  props.items.findIndex((item) => item.id === props.activeId),
);
const structure = computed(() => props.items.map((item) => item.id).join('\n'));

/** Shared by the tabs and their copies inside the pill, which must lay out identically. */
const tabClass = computed(() =>
  isTabBar.value
    ? 'flex grow basis-0 items-center justify-center whitespace-nowrap px-[min(var(--tab-padding),var(--tab-slack,var(--tab-padding)))] py-1.5 text-2xs font-medium'
    : [
        'flex min-h-9 min-w-9 shrink-0 items-center whitespace-nowrap px-3.5 py-2 text-sm/4 font-medium first:pl-5 last:pr-5',
        isStretched.value && 'grow justify-center',
      ],
);
const contentClass = computed(() =>
  isTabBar.value ? 'flex flex-col items-center gap-0.5' : 'flex items-center',
);
const contentShifts = ref<number[]>([]);
/** Each tab bar tab's share of the row left over beside the contents, halved for either side. */
const tabSlack = ref<number | null>(null);
/** A tab bar's width with every tab keeping its full padding, less that padding, in px. */
const naturalWidth = ref<number | null>(null);

/**
 * Published as `--tabs-natural-width` for the placement around a tab bar,
 * which may make more room for it before its tabs start giving up padding.
 */
const containerStyle = computed(() =>
  naturalWidth.value === null
    ? undefined
    : {
        '--tabs-natural-width': `calc(${px(naturalWidth.value)} + ${2 * props.items.length} * var(--tab-padding))`,
      },
);

function contentStyle(index: number) {
  return { translate: px(contentShifts.value[index] ?? 0) };
}

// The pill lives outside Vue's reactivity: it changes every frame, and all it
// ever touches is one style property.
const pill = new Spring(SELECT);
const press = new Spring(PRESS);

let metrics: Metrics | null = null;
/** The tab the pill rests on or is heading for; -1 while there is none. */
let targetIndex = activeIndex.value;
let pillShown = false;
let paintedClip = '';
let paintedMask = '';
let frameId = 0;
let lastFrame = 0;
let gesture: Gesture | null = null;
let suppressClicksUntil = 0;
let observer: ResizeObserver | null = null;

function reduceMotion() {
  return reducedMotion.value === 'reduce';
}

/**
 * Horizontal pans on a tab belong to the pill. In a row that scrolls, only the
 * tab the pill rests on keeps them; everywhere else the row scrolls natively.
 */
function touchAction(index: number) {
  return isScrollable.value && index !== activeIndex.value
    ? 'touch-manipulation'
    : 'touch-pan-y touch-pinch-zoom';
}

// ─── Layout ──────────────────────────────────────────────────────────────────

function tabElements() {
  return Array.from(tabsRef.value?.children ?? []) as HTMLElement[];
}

/**
 * Reads where the pill sits on every tab, with the row's scaling undone, so a
 * modal that is still scaling in reports its settled geometry.
 *
 * The pill covers its tab, and never less than the label with room either side:
 * tabs that sit close together or split the row evenly would otherwise cramp a
 * long label inside it. It is centred on the label, except at the row's ends,
 * where it meets the wall and the label moves over to stay centred in it.
 * Where the row is tight, the pill gives up padding before it crowds the
 * labels beside it.
 */
function measure(): Metrics | null {
  const row = rowRef.value;
  const tabs = tabElements();
  if (!row || tabs.length === 0 || tabs.length !== props.items.length) {
    return null;
  }

  // Hidden or not laid out yet; the resize that follows brings real numbers.
  if (tabs.some((tab) => tab.offsetWidth <= 0)) return null;

  // Fractional, unlike layout offsets: tabs sharing the row evenly rarely come
  // out at whole pixels, and a rounded one shows as a label off centre.
  const origin = row.getBoundingClientRect();
  const scale = drawnScale(row, origin);
  const along = (el: Element | null, shift = 0): [number, number] => {
    const rect = el?.getBoundingClientRect();
    if (!rect) return [0, 0];
    return [
      (rect.left - origin.left) / scale - shift,
      (rect.right - origin.left) / scale - shift,
    ];
  };

  const last = tabs.length - 1;
  const tabBoxes = tabs.map((tab) => along(tab));
  const tabLefts = tabBoxes.map(([left]) => left);
  const tabRights = tabBoxes.map(([, right]) => right);
  // Where layout puts each tab's contents, before they are moved.
  const contentBoxes = tabs.map((tab, i) =>
    along(tab.lastElementChild, contentShifts.value[i] ?? 0),
  );
  const contentHalves = contentBoxes.map(([left, right]) => (right - left) / 2);
  const laidOut = contentBoxes.map(([left, right]) => (left + right) / 2);
  const contentCenters = [...laidOut];
  const halves = tabs.map(() => 0);

  const contentLeft = (i: number) => contentCenters[i]! - contentHalves[i]!;
  const contentRight = (i: number) => contentCenters[i]! + contentHalves[i]!;

  /** Half the pill's width, with at most `room` to reach into on either side. */
  const pillHalf = (i: number, room: number) => {
    const wanted = Math.max(
      contentHalves[i]! + PILL_PADDING,
      (tabRights[i]! - tabLefts[i]!) / 2,
    );
    return Math.max(Math.min(wanted, room), contentHalves[i]!);
  };

  // The ends go first: their labels move, and their neighbours keep clear of
  // where they land.
  const firstLimit =
    last > 0 ? contentLeft(1) - LABEL_CLEARANCE : tabRights[0]!;
  halves[0] = pillHalf(0, (firstLimit - tabLefts[0]!) / 2);
  contentCenters[0] = tabLefts[0]! + halves[0];

  if (last > 0) {
    const lastLimit = contentRight(last - 1) + LABEL_CLEARANCE;
    halves[last] = pillHalf(last, (tabRights[last]! - lastLimit) / 2);
    contentCenters[last] = tabRights[last]! - halves[last];
  }

  for (let i = 1; i < last; i++) {
    const room =
      Math.min(
        contentCenters[i]! - contentRight(i - 1),
        contentLeft(i + 1) - contentCenters[i]!,
      ) - LABEL_CLEARANCE;
    halves[i] = pillHalf(i, room);
  }

  const centers = contentCenters;
  if (centers.some((center, i) => i > 0 && center <= centers[i - 1]!)) {
    return null;
  }

  const width = origin.width / scale;
  return {
    lefts: centers.map((center, i) => Math.max(center - halves[i]!, 0)),
    rights: centers.map((center, i) => Math.min(center + halves[i]!, width)),
    centers,
    contentShifts: centers.map((center, i) => center - laidOut[i]!),
    height: origin.height / scale,
  };
}

/** Tabs that would take up more than half of the available width stretch to fill it. */
function updateStretch() {
  if (isTabBar.value) return false;

  const available = containerRef.value?.clientWidth ?? 0;
  const tabs = tabElements();
  if (available <= 0 || tabs.length === 0) return false;

  let natural = 0;
  for (const tab of tabs) {
    const { paddingLeft, paddingRight } = getComputedStyle(tab);
    const label = tab.lastElementChild as HTMLElement | null;
    natural +=
      (label?.offsetWidth ?? 0) +
      parseFloat(paddingLeft) +
      parseFloat(paddingRight);
  }

  const stretched = natural > available / 2;
  if (stretched === isStretched.value) return false;

  isStretched.value = stretched;
  return true;
}

/**
 * A tab bar's tabs give up their padding evenly once the row gets too narrow
 * for all of it, rather than one tab's label ending up hard against the next.
 */
function updateSlack() {
  const bar = barRef.value;
  const row = rowRef.value;
  const tabs = tabElements();
  if (!isTabBar.value || !bar || !row || tabs.length === 0) return false;

  const scale = drawnScale(row);
  let contents = 0;
  for (const tab of tabs) {
    const width = tab.lastElementChild?.getBoundingClientRect().width ?? 0;
    contents += width / scale;
  }
  // Whole pixels, so rounding never leaves the row a hair too narrow for them.
  contents = Math.ceil(contents);

  naturalWidth.value = contents + bar.offsetWidth - row.clientWidth;

  const slack = Math.max(
    Math.floor((row.clientWidth - contents) / (2 * tabs.length)),
    0,
  );
  if (slack === tabSlack.value) return false;

  tabSlack.value = slack;
  return true;
}

/**
 * Re-reads the layout and carries the pill over to it. A pill in flight keeps
 * its place among the tabs and its speed, so a reflow — a page scrollbar
 * appearing as the content below changes, a web font finishing loading —
 * never shows as a jump or as an animation starting over.
 */
function refresh() {
  const bar = barRef.value;
  if (bar) isScrollable.value = bar.scrollWidth - bar.clientWidth > 1;

  const next = measure();
  if (!next) return;

  const previous = metrics;
  metrics = next;
  if (next.contentShifts.some((shift, i) => shift !== contentShifts.value[i])) {
    contentShifts.value = next.contentShifts;
  }

  const target = next.centers[targetIndex];
  if (target === undefined) {
    hidePill();
    return;
  }

  const now = performance.now();
  if (pillShown && previous?.centers.length === next.centers.length) {
    const [position, velocity] = pill.sample(now);
    const progress = progressAlong(previous.centers, position);
    pill.launch(valueAlong(next.centers, progress), velocity, target, now);
  } else {
    pill.jump(target);
    pillShown = true;
  }

  render(now);
  schedule();
}

function onResize() {
  // Both reflow the tabs, so measure once Vue has applied them.
  if (updateStretch() || updateSlack()) void nextTick(refresh);
  else refresh();
}

function observe() {
  if (!observer) return;

  observer.disconnect();
  const tabs = tabElements();
  const contents = tabs.map((tab) => tab.lastElementChild);
  for (const el of [containerRef.value, barRef.value, ...tabs, ...contents]) {
    if (el) observer.observe(el);
  }
}

/** Scrolls an overflowing row, and nothing around it, to centre a tab. */
function reveal(index: number, smooth: boolean) {
  const bar = barRef.value;
  const left = metrics?.lefts[index];
  const right = metrics?.rights[index];
  if (!bar || left === undefined || right === undefined) return;

  const max = bar.scrollWidth - bar.clientWidth;
  if (max <= 0) return;

  bar.scrollTo({
    left: clamp((left + right - bar.clientWidth) / 2, 0, max),
    behavior: smooth && !reduceMotion() ? 'smooth' : 'auto',
  });
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function schedule() {
  if (!frameId) frameId = requestAnimationFrame(frame);
}

function frame(now: number) {
  frameId = 0;

  const m = metrics;
  if (!m || !pillShown) {
    lastFrame = 0;
    return;
  }

  const elapsed = lastFrame ? Math.min(now - lastFrame, 100) / 1000 : 0;
  lastFrame = now;

  const g = gesture;
  let center: number;
  let moving = true;

  if (g) {
    autoscroll(g, elapsed, now);
    center = dragCenter(g, m, now);
    tickOnNewTab(g, m, center);
  } else {
    [center, moving] = pill.settle(now);
  }

  const [inset, pressing] = press.settle(now);
  paint(m, center, inset);

  if (moving || pressing) schedule();
  else lastFrame = 0;
}

function render(now: number) {
  const m = metrics;
  if (!m || !pillShown) return;

  const center = gesture ? dragCenter(gesture, m, now) : pill.sample(now)[0];

  paint(m, center, press.sample(now)[0]);
}

/**
 * Draws the pill by clipping a copy of the row, set in the active colours, to
 * the pill's shape. The labels in the copy sit exactly on top of the real ones
 * and never move, so they can't shimmer or drift out of line the way
 * counter-translated text does, and a clip only repaints: nothing is laid out
 * again while the pill moves.
 *
 * The row beneath is masked out where the pill covers it. Through a
 * translucent pill, its labels' anti-aliased edges would otherwise tint the
 * edges of their copies on top.
 */
function paint(m: Metrics, center: number, inset: number) {
  const el = pillRef.value;
  const tabs = tabsRef.value;
  if (!el || !tabs) return;

  const [left, right] = pillEdges(m, center);
  const clip = `inset(${px(inset)} calc(100% - ${px(right - inset)}) ${px(inset)} ${px(left + inset)} round 9999px)`;
  const mask = outsidePill(
    left + inset,
    inset,
    right - left - 2 * inset,
    m.height - 2 * inset,
  );
  if (clip === paintedClip && mask === paintedMask) return;

  paintedClip = clip;
  paintedMask = mask;
  el.style.clipPath = clip;
  tabs.style.mask = mask;
}

function hidePill() {
  pillShown = false;
  paintedClip = '';
  paintedMask = '';
  pillRef.value?.style.removeProperty('clip-path');
  tabsRef.value?.style.removeProperty('mask');
}

// ─── Selection ───────────────────────────────────────────────────────────────

/** Sends the pill to a tab. Interrupting a motion keeps its momentum. */
function moveTo(index: number) {
  targetIndex = index;

  const target = metrics?.centers[index];
  if (target === undefined) return;

  if (pillShown && !reduceMotion()) {
    pill.retarget(target, performance.now(), SELECT);
  } else {
    pill.jump(target);
    pillShown = true;
  }

  reveal(index, true);
  schedule();
}

function commit(index: number) {
  const item = props.items[index];
  if (item && item.id !== props.activeId) emit('change', item.id);
}

function onChange(index: number) {
  moveTo(index);
  commit(index);
}

// ─── Dragging ────────────────────────────────────────────────────────────────

/** A viewport x as a distance along the row, with scroll and any scaling undone. */
function rowX(clientX: number) {
  const row = rowRef.value;
  if (!row) return 0;

  const rect = row.getBoundingClientRect();
  return (clientX - rect.left) / drawnScale(row, rect);
}

/** The pill centre that puts the point it is held by under `x`. */
function follow(stops: readonly number[], m: Metrics, x: number) {
  return valueAlong(m.centers, progressAlong(stops, x));
}

/** The held pill: under the finger, less however far it is still catching up. */
function dragCenter(g: Gesture, m: Metrics, time: number) {
  return resist(m, follow(g.stops, m, rowX(g.clientX)) + g.lag.sample(time)[0]);
}

function tickOnNewTab(g: Gesture, m: Metrics, center: number) {
  const tab = nearestTab(m, center);
  if (tab === g.nearestTab) return;

  g.nearestTab = tab;
  haptic();
}

function record(g: Gesture, time: number) {
  g.tracker.record(time, rowX(g.clientX));
}

function setPressed(pressed: boolean) {
  if (reduceMotion()) press.jump(0);
  else press.retarget(pressed ? PRESS_INSET : 0, performance.now());

  schedule();
}

/**
 * Picks the pill up under the pressing finger. A finger on the pill holds it
 * right where it pressed, catching it if it was still moving. A finger on
 * another tab holds the pill where it touches that tab, and the pill glides
 * over from wherever it was, at the speed it already had.
 */
function onPointerDown(event: PointerEvent) {
  // A new press owns whatever click comes next.
  suppressClicksUntil = 0;

  const m = metrics;
  const bar = barRef.value;
  if (gesture || !m || !bar || !pillShown || m.centers.length < 2) return;
  if (!event.isPrimary || event.button !== 0) return;

  const now = performance.now();
  const [center, velocity] = pill.sample(now);
  const [left, right] = pillEdges(m, center);
  const x = rowX(event.clientX);
  const onPill = x >= left && x <= right;

  // In a row that scrolls, a finger landing beside the pill is scrolling it.
  if (event.pointerType !== 'mouse' && isScrollable.value && !onPill) return;

  const tab = tabAt(m, x);
  const [heldLeft, heldRight] = onPill
    ? [left, right]
    : [m.lefts[tab]!, m.rights[tab]!];
  const grip =
    heldRight > heldLeft
      ? clamp((x - heldLeft) / (heldRight - heldLeft), 0, 1)
      : 0.5;
  const stops = m.lefts.map(
    (tabLeft, index) => tabLeft + grip * (m.rights[index]! - tabLeft),
  );

  const g: Gesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    clientX: event.clientX,
    claimed: event.pointerType === 'mouse',
    stops,
    lag: new Spring(CATCH_UP),
    tracker: new VelocityTracker(),
    scroll: bar.scrollLeft,
    nearestTab: nearestTab(m, center),
  };

  if (reduceMotion()) g.lag.jump(0);
  else
    g.lag.launch(center - follow(stops, m, x), onPill ? 0 : velocity, 0, now);

  gesture = g;
  record(g, now);
  setPressed(true);
  isDragging.value = true;

  try {
    bar.setPointerCapture(g.pointerId);
  } catch {
    // The pointer is already gone; its pointerup or cancel still ends the drag.
  }

  window.addEventListener('pointermove', onPointerMove, CAPTURE);
  window.addEventListener('pointerup', onPointerUp, CAPTURE);
  window.addEventListener('pointercancel', onPointerCancel, CAPTURE);
  window.addEventListener('touchmove', onTouchMove, CAPTURE_ACTIVE);
  window.addEventListener('keydown', onKeyDown, CAPTURE);
  window.addEventListener('blur', onBlur);
}

function onPointerMove(event: PointerEvent) {
  const g = gesture;
  if (!g || event.pointerId !== g.pointerId) return;

  g.clientX = event.clientX;

  if (!g.claimed) {
    const axis = lockAxis(event.clientX - g.startX, event.clientY - g.startY);

    // A pan that sets off up or down is the page's: bowing out now, before a
    // single touch move has been taken, leaves the browser free to scroll it.
    // Once claimed, no amount of vertical travel takes the pill back.
    if (axis === 'y') {
      end(true);
      return;
    }

    g.claimed = axis === 'x';
  }

  record(g, performance.now());
  schedule();
}

function onPointerUp(event: PointerEvent) {
  const g = gesture;
  if (!g || event.pointerId !== g.pointerId) return;

  g.clientX = event.clientX;
  record(g, performance.now());
  end(false);
}

function onPointerCancel(event: PointerEvent) {
  if (gesture && event.pointerId === gesture.pointerId) end(true);
}

/**
 * Every move a held pill makes is taken, whichever direction it goes in. A
 * browser that has had one move cancelled starts no scroll for the rest of the
 * gesture, so a finger is free to wander as far up or down as it likes: the
 * pill stays tied to it, and the page stays put, until it lets go.
 */
function onTouchMove(event: TouchEvent) {
  if (gesture?.claimed && event.cancelable) event.preventDefault();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !gesture) return;

  // Puts the pill back, without also closing a modal the tabs sit in.
  event.preventDefault();
  event.stopPropagation();
  end(true);
}

function onBlur() {
  end(true);
}

function end(cancelled: boolean) {
  const g = gesture;
  if (!g) return;

  gesture = null;
  window.removeEventListener('pointermove', onPointerMove, CAPTURE);
  window.removeEventListener('pointerup', onPointerUp, CAPTURE);
  window.removeEventListener('pointercancel', onPointerCancel, CAPTURE);
  window.removeEventListener('touchmove', onTouchMove, CAPTURE_ACTIVE);
  window.removeEventListener('keydown', onKeyDown, CAPTURE);
  window.removeEventListener('blur', onBlur);

  setPressed(false);
  isDragging.value = false;
  suppressClicksUntil = performance.now() + CLICK_SUPPRESS_WINDOW;

  const bar = barRef.value;
  if (bar?.hasPointerCapture(g.pointerId)) {
    bar.releasePointerCapture(g.pointerId);
  }

  release(g, cancelled);
}

/**
 * Lets go of the pill. It lands on the tab its momentum points at and springs
 * there from exactly where it is, at exactly the speed it is going, so the
 * hand-off from finger to spring never shows.
 */
function release(g: Gesture, cancelled: boolean) {
  const m = metrics;
  if (!m) return;

  const { stops } = g;
  const now = performance.now();
  const reach = follow(stops, m, rowX(g.clientX));
  const speed = g.tracker.velocity(now, (x) => follow(stops, m, x)) * 1000;

  // On screen the pill may still be catching up, or giving way at an end, so
  // its real speed is measured across the next millisecond.
  const center = resist(m, reach + g.lag.sample(now)[0]);
  const ahead = resist(m, reach + speed / 1000 + g.lag.sample(now + 1)[0]);
  const maxSpeed = MAX_FLING_SPEED * 1000;
  const velocity = clamp((ahead - center) * 1000, -maxSpeed, maxSpeed);

  const index = cancelled
    ? targetIndex
    : landingIndex(m, resist(m, reach), speed);
  const target = m.centers[index];
  if (target === undefined) return;

  targetIndex = index;
  if (reduceMotion()) pill.jump(target);
  else pill.launch(center, velocity, target, now, RELEASE);
  schedule();

  if (cancelled) return;

  // What a tap would have done to the radio.
  const input = tabElements()[index]?.querySelector('input');
  if (input) input.checked = true;

  reveal(index, true);
  commit(index);
}

/** Scrolls an overflowing row while the dragging finger pushes into one of its ends. */
function autoscroll(g: Gesture, elapsed: number, now: number) {
  const bar = barRef.value;
  if (!bar || elapsed === 0) return;

  const max = bar.scrollWidth - bar.clientWidth;
  if (max <= 0) return;

  const { left, right, width } = bar.getBoundingClientRect();
  const edge = Math.min(AUTOSCROLL_EDGE, width / 4);

  let push = 0;
  if (g.clientX < left + edge && g.clientX < g.startX) {
    push = -Math.min(1, (left + edge - g.clientX) / edge);
  } else if (g.clientX > right - edge && g.clientX > g.startX) {
    push = Math.min(1, (g.clientX - right + edge) / edge);
  }
  if (push === 0) return;

  // Browsers may round what they are given, so the exact position lives here.
  if (Math.abs(bar.scrollLeft - g.scroll) > 1) g.scroll = bar.scrollLeft;

  const scroll = clamp(
    g.scroll + push * Math.abs(push) * AUTOSCROLL_SPEED * elapsed,
    0,
    max,
  );
  if (scroll === g.scroll) return;

  g.scroll = scroll;
  bar.scrollLeft = scroll;
  record(g, now);
}

/** The click a drag's pointer may still produce must not pick the tab it ended on. */
function onClickCapture(event: MouseEvent) {
  if (performance.now() > suppressClicksUntil) return;

  suppressClicksUntil = 0;
  event.preventDefault();
  event.stopPropagation();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

watch(
  [structure, activeIndex],
  ([key, index], [previousKey]) => {
    if (key !== previousKey) {
      // Different tabs: whatever the pill was doing belonged to the old ones.
      end(true);
      targetIndex = index;
      metrics = null;
      pillShown = false;
      observe();
      onResize();
      void nextTick(() => reveal(targetIndex, false));
      return;
    }

    if (index === targetIndex) return;

    if (index === -1) {
      end(true);
      targetIndex = -1;
      hidePill();
    } else if (gesture) {
      // The drag decides where the pill goes; if it is cancelled, it goes here.
      targetIndex = index;
    } else {
      moveTo(index);
    }
  },
  { flush: 'post' },
);

onMounted(() => {
  observer = new ResizeObserver(onResize);
  observe();
  onResize();
  void nextTick(() => reveal(targetIndex, false));
});

onBeforeUnmount(() => {
  end(true);
  observer?.disconnect();
  observer = null;
  cancelAnimationFrame(frameId);
  frameId = 0;
});
</script>

<template>
  <div
    ref="containerRef"
    class="flex w-full items-center justify-start"
    :class="isTabBar && 'relative [--tab-padding:--spacing(2)]'"
    :style="containerStyle"
  >
    <BaseGlassRefraction v-if="isTabBar" />
    <div
      ref="barRef"
      class="relative isolate flex max-w-full overflow-x-auto overflow-y-hidden rounded-full border border-ghost-border scrollbar-hide select-none [-webkit-touch-callout:none] has-focus-visible:ring-2 has-focus-visible:ring-focus"
      :class="[
        isTabBar
          ? 'bg-surface/80 p-1 shadow-menu backdrop-blur-[2px] backdrop-saturate-150'
          : 'bg-surface shadow-input',
        fillsWidth ? 'w-full' : 'w-max',
        isDragging && 'cursor-grabbing **:cursor-grabbing',
      ]"
      @pointerdown="onPointerDown"
      @click.capture="onClickCapture"
    >
      <div
        ref="rowRef"
        role="radiogroup"
        class="relative grid overflow-x-clip"
        :class="
          isTabBar ? 'w-full' : isStretched ? 'w-full min-w-max' : 'w-max'
        "
        :style="tabSlack === null ? undefined : { '--tab-slack': px(tabSlack) }"
      >
        <div ref="tabsRef" class="col-start-1 row-start-1 flex">
          <label
            v-for="(item, index) in items"
            :key="item.id"
            class="relative cursor-pointer text-on-ghost-muted transition-hover hover:text-on-ghost touch-target after:min-h-12 after:min-w-12"
            :class="[tabClass, touchAction(index)]"
          >
            <input
              type="radio"
              class="sr-only"
              :name="groupName"
              :value="item.id"
              :checked="item.id === activeId"
              @change="onChange(index)"
            />
            <span :class="contentClass" :style="contentStyle(index)">
              <component
                :is="item.icon"
                v-if="item.icon"
                class="shrink-0"
                :stroke-width="1.8"
                aria-hidden="true"
              />
              <span>{{ item.label }}</span>
            </span>
          </label>
        </div>

        <!-- The pill: the same row in the active colours, clipped to its shape -->
        <div
          ref="pillRef"
          class="pointer-events-none relative z-1 col-start-1 row-start-1 flex [clip-path:inset(0_100%_0_0)] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none"
          :class="
            isTabBar
              ? 'bg-ghost-hover text-on-ghost'
              : 'bg-action text-on-action'
          "
          aria-hidden="true"
        >
          <span v-for="(item, index) in items" :key="item.id" :class="tabClass">
            <span :class="contentClass" :style="contentStyle(index)">
              <component
                :is="item.icon"
                v-if="item.icon"
                class="shrink-0"
                :stroke-width="1.8"
              />
              <span>{{ item.label }}</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
