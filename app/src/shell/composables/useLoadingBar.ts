import { shallowRef, watch } from 'vue';
import { prefersReducedMotion, SETTLE_EASING } from '@/common/utils/motion';
import {
  TRICKLE_DURATION,
  TRICKLE_LIMIT,
  trickleKeyframes,
} from '@/shell/utils/loadingBarProgress';

// A navigation that settles within this time never shows the bar, so instant
// ones don't flash it.
const SHOW_DELAY = 150;
const FADE_IN_DURATION = 150;
const COMPLETE_DURATION = 400;
// The settle curve covers nearly all of its distance in its first half, so
// the bar fades once it reads as full.
const FADE_OUT_DELAY = 200;
const FADE_OUT_DURATION = 300;

/**
 * `queued`: a navigation started once the last one had visibly completed; it
 * gets a fresh bar as soon as the completed one has faded out.
 */
type Phase = 'idle' | 'loading' | 'finishing' | 'queued';

const bar = shallowRef<HTMLElement | null>(null);
let phase: Phase = 'idle';
let animations: Animation[] = [];
let startedAt = 0;
let startScale = 0;
let startOpacity = 0;

function cancelAnimations() {
  animations.forEach((animation) => animation.cancel());
  animations = [];
}

function reset() {
  cancelAnimations();
  phase = 'idle';
}

function drawnState(el: HTMLElement) {
  const style = getComputedStyle(el);
  const scale =
    style.transform === 'none' ? 1 : new DOMMatrixReadOnly(style.transform).a;
  return { scale, opacity: Number(style.opacity) };
}

// Navigation is when the main thread is busiest, loading chunks and rendering
// the next page. Web Animations of transform and opacity run on the
// compositor, so the bar keeps moving through that where a JS-driven width
// would stutter, and never triggers layout.
function play(el: HTMLElement) {
  cancelAnimations();
  animations.push(
    el.animate([{ opacity: startOpacity }, { opacity: 1 }], {
      delay: startOpacity > 0 ? 0 : SHOW_DELAY,
      duration: FADE_IN_DURATION,
      fill: 'both',
    }),
  );
  // With reduced motion the bar stays full and only fades in and out.
  if (!prefersReducedMotion()) {
    animations.push(
      el.animate(trickleKeyframes(startScale), {
        duration: TRICKLE_DURATION,
        fill: 'forwards',
      }),
    );
  }
  // The bar mounts after the first navigation has started; it picks up where
  // that navigation would have drawn it by now.
  const elapsed = performance.now() - startedAt;
  animations.forEach((animation) => (animation.currentTime = elapsed));
}

function startFrom(scale: number, opacity: number) {
  startScale = scale;
  startOpacity = opacity;
  startedAt = performance.now();
  phase = 'loading';
  if (bar.value) play(bar.value);
}

function start() {
  if (phase === 'loading' || phase === 'queued') return;

  const el = bar.value;
  if (phase !== 'finishing' || !el) {
    startFrom(0, 0);
    return;
  }

  // A navigation that starts while the last one completes, such as a
  // redirect, carries the bar on from where it is drawn. Once the bar reads
  // as full, carrying on would leave it stuck there instead.
  const { scale, opacity } = drawnState(el);
  if (scale > TRICKLE_LIMIT) phase = 'queued';
  else startFrom(scale, opacity);
}

function finish() {
  if (phase === 'queued') phase = 'finishing';
  if (phase !== 'loading') return;

  const el = bar.value;
  const visibleFrom = startedAt + (startOpacity > 0 ? 0 : SHOW_DELAY);
  if (!el || performance.now() < visibleFrom) {
    reset();
    return;
  }

  const { scale, opacity } = drawnState(el);
  cancelAnimations();
  phase = 'finishing';

  const fadeOut = el.animate([{ opacity }, { opacity: 0 }], {
    delay: FADE_OUT_DELAY,
    duration: FADE_OUT_DURATION,
    fill: 'both',
  });
  fadeOut.onfinish = () => {
    // A finish event already queued still fires after a new navigation has
    // cancelled this fade, and must not hide that navigation's bar.
    if (!animations.includes(fadeOut)) return;
    if (phase === 'queued') startFrom(0, 0);
    else reset();
  };
  animations.push(fadeOut);

  if (scale < 1) {
    animations.push(
      el.animate(
        [{ transform: `scaleX(${scale})` }, { transform: 'scaleX(1)' }],
        {
          duration: COMPLETE_DURATION,
          easing: SETTLE_EASING,
          fill: 'forwards',
        },
      ),
    );
  }
}

watch(bar, (el) => {
  if (el && phase === 'loading') play(el);
});

export function useLoadingBar() {
  return { bar, start, finish };
}
