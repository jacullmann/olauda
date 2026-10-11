import { nextTick, onScopeDispose } from 'vue';
import { drawnMatrix } from '@/common/utils/gesture';
import { GLIDE_EASING, prefersReducedMotion } from '@/common/utils/motion';
import {
  closeKeyframes,
  colorAlpha,
  DIM_ALPHA,
  dimAt,
  dimKeyframes,
  frameState,
  openKeyframes,
  thumbCloseKeyframes,
  tileShape,
} from '@/modules/tasks/utils/imageViewerMotion';
import type { ImageViewerControls } from './useImageViewerControls';

// Both directions decelerate into their end state on the same curve, so the
// viewer settles onto the tile the way it grew out of it. The close is a touch
// shorter, because a movement towards something already on screen reads as
// slower than the same movement away from it.
const OPEN_DURATION = 420;
const CLOSE_DURATION = 360;
const FADE_DURATION = 300;
// The tile fades back in under the viewer once the zoom has left it.
const TILE_FADE_IN_DURATION = FADE_DURATION;
// Short, so the slot is empty well before the closing frame arrives in it.
const TILE_FADE_OUT_DURATION = 150;

interface ViewerTransitionOptions {
  /** The grid tile the current image was opened from, if it can be grown out of. */
  originTile: () => HTMLElement | null;
  /** Whether the current image has loaded, so the thumbnail can hand over to it. */
  fullLoaded: () => boolean;
  controls: ImageViewerControls;
  /** Once the open has played out; `completed` is false when a close cut it short. */
  onOpened: (completed: boolean) => void;
}

// Read from the DOM rather than through template refs: Vue clears the refs as
// soon as the viewer unmounts, while the element itself stays around for the
// close animation.
function zoomParts(backdrop: HTMLElement) {
  const frame = backdrop.querySelector<HTMLElement>('[data-viewer-frame]');
  const inner = backdrop.querySelector<HTMLElement>('[data-viewer-inner]');
  const thumb = backdrop.querySelector<HTMLElement>('[data-viewer-thumb]');
  const controls = backdrop.querySelector<HTMLElement>(
    '[data-viewer-controls]',
  );
  return frame && inner ? { frame, inner, thumb, controls } : null;
}

// allSettled, not all: a cancelled animation rejects its promise straight
// away, which would otherwise end the whole group while the rest still runs.
function settle(animations: Animation[], done: () => void) {
  void Promise.allSettled(
    animations.map((animation) => animation.finished),
  ).then(done);
}

function cancelAnimations(el: Element | null | undefined) {
  el?.getAnimations().forEach((animation) => animation.cancel());
}

// Once the viewer is on its way out Vue no longer patches it, so a slide or a
// swipe that was still easing back would carry on under the close and pull
// the frame off the path it was measured for. Pinned where they are drawn,
// they hold still for it.
function freezeAt(el: HTMLElement | null) {
  if (!el) return;
  const transform = getComputedStyle(el).transform;
  el.style.transition = 'none';
  el.style.transform = transform || 'none';
}

/**
 * The viewer grows out of the tile it was opened from and shrinks back into
 * it, picking every part up from wherever a gesture or a cut short animation
 * left it. Without a tile to fly to, it fades.
 */
export function useImageViewerTransition(options: ViewerTransitionOptions) {
  const { controls } = options;

  let zooming = false;
  // Set once the close has taken over, so an open that is cut short does not
  // finish its own bookkeeping on an element that is already on its way out.
  let leaving = false;
  // The dim of the open. A swipe that starts while it still runs takes the dim
  // over, so it has to be able to stop it where it is.
  let openDimAnimation: Animation | null = null;

  // The tile steps out while the picture flies out of it or back into it, so
  // the picture is never on screen twice in motion. At rest the tile is back
  // in its slot under the viewer. Keyed by tile, because a close can still be
  // fading one tile while a reopen fades another.
  const tileFades = new Map<HTMLElement, Animation>();

  // Picks the tile up from wherever an earlier fade left it. Without a target
  // it fades back to the tile's own opacity and lets go of it.
  function fadeTile(el: HTMLElement, to: number | null, duration: number) {
    const from = Number(getComputedStyle(el).opacity);
    tileFades.get(el)?.cancel();

    const fade = el.animate(
      to === null
        ? [{ offset: 0, opacity: from }]
        : [{ opacity: from }, { opacity: to }],
      { duration, easing: 'ease', fill: to === null ? 'none' : 'forwards' },
    );
    tileFades.set(el, fade);

    if (to === null) {
      void fade.finished.then(
        () => releaseTile(el, fade),
        () => {},
      );
    }
    return fade;
  }

  // Hands the tile straight back, unless a later fade has taken it over since.
  function releaseTile(el: HTMLElement, fade: Animation) {
    if (tileFades.get(el) !== fade) return;
    tileFades.delete(el);
    fade.cancel();
  }

  // Every tile still stepped out, other than the one the viewer is heading for.
  function restoreTiles(except: HTMLElement | null) {
    for (const el of tileFades.keys()) {
      if (el !== except) fadeTile(el, null, TILE_FADE_IN_DURATION);
    }
  }

  function originTile() {
    return prefersReducedMotion() ? null : options.originTile();
  }

  /**
   * Stops the open's dim where it has got to, for a swipe that takes the dim
   * over. Returns that strength, 1 being the backdrop at rest, or null when
   * the open is not dimming any more.
   */
  function interruptOpenDim(backdrop: HTMLElement | undefined) {
    const animation = openDimAnimation;
    if (!animation || animation.playState === 'finished') return null;

    openDimAnimation = null;
    const alpha = backdrop
      ? colorAlpha(getComputedStyle(backdrop).backgroundColor)
      : DIM_ALPHA;
    animation.cancel();
    return Math.min(1, Math.max(0, alpha / DIM_ALPHA));
  }

  async function onEnter(el: Element, done: () => void) {
    const backdrop = el as HTMLElement;
    leaving = false;

    await nextTick();

    // Closed again before the open had even started.
    if (leaving) return;

    const parts = zoomParts(backdrop);
    const tile = parts ? originTile() : null;
    // A reopen cut the last close short, and its tile never got its landing.
    restoreTiles(tile);

    if (!tile || !parts) {
      controls.show();
      settle(
        [
          backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: FADE_DURATION,
            easing: 'ease',
          }),
        ],
        done,
      );
      return;
    }

    const timing: KeyframeAnimationOptions = {
      duration: OPEN_DURATION,
      easing: GLIDE_EASING,
    };
    const keyframes = openKeyframes(
      tileShape(tile),
      parts.frame.getBoundingClientRect(),
    );
    openDimAnimation = backdrop.animate(dimKeyframes(), timing);
    const animations = [
      openDimAnimation,
      parts.frame.animate(keyframes.frame, timing),
      parts.inner.animate(keyframes.inner, timing),
    ];

    // Without the image there is nothing to hand over to yet, so the thumbnail
    // stays up and its own fade takes over once the image arrives.
    if (parts.thumb && options.fullLoaded()) {
      animations.push(parts.thumb.animate(keyframes.thumb, timing));
    }

    // The controls belong to the frame, so they arrive with it on the same
    // curve as the dim, rather than waiting for the zoom to be over.
    if (parts.controls) {
      animations.push(
        parts.controls.animate([{ opacity: 0 }, { opacity: 1 }], timing),
      );
    }

    // What grows out of the tile is the viewer's own copy of the picture, so
    // the slot is left empty behind it.
    fadeTile(tile, 0, 0);
    zooming = true;

    settle(animations, () => {
      zooming = false;
      openDimAnimation = null;

      // A close cut the open short and has taken over from here.
      if (leaving) {
        options.onOpened(false);
        done();
        return;
      }

      options.onOpened(true);
      fadeTile(tile, null, TILE_FADE_IN_DURATION);
      // The controls are already up; this only starts the idle timer that
      // takes them away again.
      controls.show();
      done();
    });
  }

  function onLeave(el: Element, done: () => void) {
    const backdrop = el as HTMLElement;
    leaving = true;
    zooming = false;
    openDimAnimation = null;
    controls.stopIdleTimer();

    const stage = backdrop.querySelector<HTMLElement>('[data-viewer-stage]');
    const zoom = backdrop.querySelector<HTMLElement>('[data-viewer-zoom]');
    freezeAt(stage);
    freezeAt(backdrop.querySelector<HTMLElement>('[data-viewer-track]'));
    freezeAt(zoom);

    const parts = zoomParts(backdrop);
    const tile = parts ? originTile() : null;
    // An open cut short, or one that paged away, may have left a tile out.
    restoreTiles(tile);

    // Everything is picked up from where it is drawn right now, before the
    // animations that put it there are taken off. The open may still be
    // running, or a swipe may have faded the dim and moved the stage.
    const backdropStyle = getComputedStyle(backdrop);
    const dimFrom: Keyframe = {
      backgroundColor: backdropStyle.backgroundColor,
      backdropFilter: backdropStyle.backdropFilter,
      webkitBackdropFilter: backdropStyle.backdropFilter,
    };
    const opacityFrom = Number(backdropStyle.opacity);

    if (!tile || !parts) {
      // The whole backdrop fades, controls included.
      controls.hide();
      cancelAnimations(backdrop);

      settle(
        [
          backdrop.animate([{ opacity: opacityFrom }, { opacity: 0 }], {
            duration: FADE_DURATION,
            easing: 'ease',
            fill: 'forwards',
          }),
        ],
        done,
      );
      return;
    }

    // The slot empties before the frame arrives, and the viewer's thumbnail,
    // pixel for pixel the tile, hands over to it on landing.
    const tileFade = fadeTile(tile, 0, TILE_FADE_OUT_DURATION);
    const finish = () => {
      releaseTile(tile, tileFade);
      done();
    };

    const from = frameState(parts.frame, parts.inner);
    const thumbFrom = parts.thumb
      ? Number(getComputedStyle(parts.thumb).opacity)
      : 1;
    const controlsStyle = parts.controls
      ? getComputedStyle(parts.controls)
      : null;
    const controlsFrom =
      controlsStyle && controlsStyle.display !== 'none'
        ? Number(controlsStyle.opacity)
        : 0;
    // The zoom only counts when it is on the frame that flies home, not on an
    // image a page turn is still carrying off.
    const zoomScaleFrom = zoom?.contains(parts.frame)
      ? drawnMatrix(zoom).a || 1
      : 1;
    const ancestorScale = (drawnMatrix(stage).a || 1) * zoomScaleFrom;

    for (const part of [
      backdrop,
      parts.frame,
      parts.inner,
      parts.thumb,
      parts.controls,
    ]) {
      cancelAnimations(part);
    }

    // Held at the end state, otherwise the frame snaps back to full size for
    // the frame or two between the animation finishing and the unmount.
    const timing: KeyframeAnimationOptions = {
      duration: CLOSE_DURATION,
      easing: GLIDE_EASING,
      fill: 'forwards',
    };
    // Measured with the open taken off, so this is the frame's resting rect
    // under whatever the swipe left on the stage.
    const keyframes = closeKeyframes(
      tileShape(tile),
      parts.frame.getBoundingClientRect(),
      from,
      ancestorScale,
    );
    const animations = [
      backdrop.animate([dimFrom, dimAt(0)], timing),
      parts.frame.animate(keyframes.frame, timing),
      parts.inner.animate(keyframes.inner, timing),
    ];

    if (parts.thumb) {
      animations.push(
        parts.thumb.animate(thumbCloseKeyframes(thumbFrom), timing),
      );
    }

    // Controls the idle timer has already taken away are gone, and fading a
    // hidden element would only hold it in the layout for nothing.
    if (parts.controls && controlsFrom > 0) {
      animations.push(
        parts.controls.animate(
          [{ opacity: controlsFrom }, { opacity: 0 }],
          timing,
        ),
      );
    }

    settle(animations, finish);
  }

  onScopeDispose(() => {
    tileFades.forEach((fade) => fade.cancel());
    tileFades.clear();
  });

  return {
    onEnter,
    onLeave,
    interruptOpenDim,
    /** Whether the open is still growing the frame out of its tile. */
    isZooming: () => zooming,
  };
}
