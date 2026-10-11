import type { Ref } from 'vue';
import {
  FLICK_VELOCITY,
  lockAxis,
  MIN_GLIDE_MS,
  PAGE_COMMIT_FRACTION,
  rubberBand,
  VelocityTracker,
} from '@/common/utils/gesture';
import { glideDuration } from '@/common/utils/motion';
import { SLIDE_DURATION } from '@/modules/tasks/utils/imageViewerMotion';
import {
  FLICK_MIN_DISTANCE,
  type ImageViewerDismiss,
} from './useImageViewerDismiss';
import type { ImageViewerControls } from './useImageViewerControls';
import type { ImageViewerTrack } from './useImageViewerTrack';
import type { ImageViewerZoom } from './useImageViewerZoom';

// How far a zoomed in image can be pulled past its edge, as the share of the
// viewport it approaches but never reaches.
const PAN_OVERSCROLL = 0.15;
// How close in px an image has to sit to its edge for a pan to count as
// starting there. Reading a zoom back off the screen can leave it a fraction
// of a pixel short.
const PAN_EDGE_TOLERANCE = 1;
// A pan that is let go of carries on as far as it would travel in this many
// ms at the speed it was released at.
const PAN_MOMENTUM = 200;
// The click a touch sequence ends with belongs to the drag, not to the
// backdrop, for this long after it lets go.
const CLICK_AFTER_DRAG_MS = 400;

interface ViewerGestureOptions {
  currentIndex: Readonly<Ref<number>>;
  viewport: { width: Readonly<Ref<number>>; height: Readonly<Ref<number>> };
  track: ImageViewerTrack;
  zoom: ImageViewerZoom;
  dismiss: ImageViewerDismiss;
  controls: ImageViewerControls;
  /** Whether the current image can be pinched; documents handle their own. */
  canZoom: () => boolean;
  /** For a swipe down, which takes the open's dim over if it is still running. */
  onDismissStart: () => void;
  onDismiss: () => void;
}

/**
 * One finger turns the page sideways, pushes the image away downwards, or pans
 * an image that is zoomed in on; two fingers pinch. Each gesture picks up
 * whatever motion it lands on from where it is drawn.
 */
export function useImageViewerGestures(options: ViewerGestureOptions) {
  const { viewport, track, zoom, dismiss, controls } = options;

  let dragging = false;
  // A drag on a zoomed in image pans it rather than turning the page or
  // pushing the image away.
  let axis: 'none' | 'x' | 'y' | 'pan' = 'none';
  let moved = false;
  let startX = 0;
  let startY = 0;
  let trackBase = 0;
  let endedAt = 0;
  let panBaseX = 0;
  let panBaseY = 0;
  // Whether the pan started with the image against its left or right edge,
  // which is the only way it may turn the page towards that side.
  let panTurnsToPrev = false;
  let panTurnsToNext = false;
  const velocityX = new VelocityTracker();
  const velocityY = new VelocityTracker();

  function startPinch(event: TouchEvent) {
    if (zoom.isPinching() || !options.canZoom()) return;
    // A drag that already turns the page or pushes the image away keeps the
    // gesture: scaling the image under it would leave neither in a sensible
    // place.
    if (dragging && (axis === 'x' || axis === 'y')) return;
    if (track.dragOffset.value !== 0 || dismiss.active.value) return;

    if (!zoom.startPinch(event.touches)) return;

    // The finger that was already down gives up its drag to the pinch.
    dragging = false;
    track.settle(0);
    controls.hide();
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      startPinch(event);
      return;
    }

    // The open does not lock the gesture out: the frame keeps growing on its
    // own layer while the stage above it follows the finger.
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) return;

    // Dropping a running transition and taking over its offset in the same
    // tick keeps a track caught mid-slide from jumping to its next stop.
    trackBase = track.grab();
    dismiss.grab();

    zoom.takeOver();
    panBaseX = zoom.x.value;
    panBaseY = zoom.y.value;
    if (zoom.isZoomed.value) {
      const limits = zoom.panLimits(zoom.scale.value);
      panTurnsToPrev = panBaseX >= limits.x - PAN_EDGE_TOLERANCE;
      panTurnsToNext = panBaseX <= -limits.x + PAN_EDGE_TOLERANCE;
    }

    startX = touch.clientX;
    startY = touch.clientY;
    velocityX.reset();
    velocityY.reset();
    velocityX.record(event.timeStamp, touch.clientX);
    velocityY.record(event.timeStamp, touch.clientY);
    dragging = true;
    axis = 'none';
    moved = false;
  }

  function onTouchMove(event: TouchEvent) {
    if (zoom.isPinching()) {
      zoom.movePinch(event);
      return;
    }
    if (!dragging) return;

    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (axis === 'none') {
      const locked = lockAxis(dx, dy);
      if (!locked) return;
      axis = zoom.isZoomed.value ? 'pan' : locked;
      if (axis === 'y') options.onDismissStart();
    }

    if (event.cancelable) event.preventDefault();
    velocityX.record(event.timeStamp, touch.clientX);
    velocityY.record(event.timeStamp, touch.clientY);
    moved = true;

    if (axis === 'y') {
      dismiss.drag(dx, dy);
      // The controls belong to the image at rest, so they step aside while it
      // is being pushed away.
      controls.hide();
    } else if (axis === 'pan') {
      pan(dx, dy);
    } else {
      track.drag(trackBase + dx);
      controls.show();
    }
  }

  // Within its edges the image follows the finger, and past them it only
  // gives a little. A pan that started against a side edge hands what is left
  // of the drag past it to the track instead, so the next image can be pulled
  // in without zooming out first. One that only runs into the edge on the way
  // does not: it was moving the image, not asking for the next one.
  function pan(dx: number, dy: number) {
    const limits = zoom.panLimits(zoom.scale.value);

    const rawX = panBaseX + dx;
    const clampedX = Math.min(limits.x, Math.max(-limits.x, rawX));
    const overflowX = rawX - clampedX;
    const turning =
      overflowX > 0 ? panTurnsToPrev : overflowX < 0 && panTurnsToNext;

    if (turning) {
      zoom.x.value = clampedX;
      track.drag(trackBase + overflowX);
    } else {
      zoom.x.value =
        clampedX + rubberBand(overflowX, viewport.width.value * PAN_OVERSCROLL);
      track.dragOffset.value = trackBase;
    }

    const rawY = panBaseY + dy;
    const clampedY = Math.min(limits.y, Math.max(-limits.y, rawY));
    zoom.y.value =
      clampedY +
      rubberBand(rawY - clampedY, viewport.height.value * PAN_OVERSCROLL);
  }

  function onTouchEnd(event: TouchEvent) {
    if (zoom.isPinching()) {
      if (zoom.endPinch(event)) endedAt = Date.now();
      return;
    }
    if (!dragging) return;
    dragging = false;

    // A tap leaves the track where it was, but may still have taken a running
    // slide's transition off it, so the track is handed back either way. The
    // same goes for a zoom it caught on its way back into its limits.
    if (axis === 'none' || !moved) {
      track.settle(0);
      zoom.settle();
      return;
    }

    endedAt = Date.now();
    const now = event.timeStamp;
    const speedX = velocityX.velocity(now);

    if (axis === 'y') {
      // The stage keeps the offset it was let go at, and the close animation
      // picks the frame up from there and carries it into its tile.
      if (dismiss.isEnough(velocityY.velocity(now))) options.onDismiss();
      else {
        dismiss.returnToRest();
        controls.show();
      }
      return;
    }

    // What the pan pushed past the image's edge is on the track, which turns
    // the page or falls back like any other drag.
    if (axis === 'pan') {
      zoom.settle(SLIDE_DURATION, {
        x: speedX * PAN_MOMENTUM,
        y: velocityY.velocity(now) * PAN_MOMENTUM,
      });
    }

    const offset = track.dragOffset.value;
    const distance = Math.abs(offset);
    const enough =
      distance > viewport.width.value * PAGE_COMMIT_FRACTION ||
      (Math.abs(speedX) > FLICK_VELOCITY && distance > FLICK_MIN_DISTANCE);
    const canTurn = offset < 0 ? track.hasNext.value : track.hasPrev.value;

    if (enough && canTurn) {
      const remaining = Math.max(0, track.pageStep.value - distance);
      const step = offset < 0 ? 1 : -1;
      track.slideTo(
        options.currentIndex.value + step,
        glideDuration(remaining, Math.abs(speedX), {
          min: MIN_GLIDE_MS,
          max: SLIDE_DURATION,
        }),
      );
      return;
    }

    track.snapBack();
  }

  function reset() {
    dragging = false;
    zoom.cancelPinch();
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    reset,
    /** Whether a click is the tail of a drag that just let go, not a tap. */
    endedRecently: () => Date.now() - endedAt < CLICK_AFTER_DRAG_MS,
  };
}
