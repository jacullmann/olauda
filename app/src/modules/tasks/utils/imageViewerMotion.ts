import { drawnMatrix } from '@/common/utils/gesture';
import { isOfficeDocument, isPdf, type StoredFile } from '@/api/files';

// A slide that is not thrown decelerates on the same curve and over the same
// time as the open, so the two movements of the viewer read as one material.
export const SLIDE_DURATION = 420;
// A drag released short of the threshold falls back, which is a smaller
// movement than a page turn and so a shorter one.
export const SNAP_DURATION = 300;
// How much longer than a transition the timer that takes it off waits, so it
// never cuts the last frame short.
export const TRANSITION_SLACK_MS = 40;

// The task grid's rounded-sm, for a tile whose corners cannot be read. The
// viewer frame is rounded-xl.
export const THUMB_RADIUS = 4;
export const FRAME_RADIUS = 16;
// BaseBackdrop defaults: bg-black/40 with backdrop-blur-md.
export const DIM_ALPHA = 0.4;
const BLUR_RADIUS = 12;
// Steps used to sample the counter scale of the image inside the frame.
const ZOOM_SAMPLES = 24;
// Where the thumbnail hands over to the image, in animation progress. Early,
// because the thumbnail only stands for the same picture at the tile end: the
// swap happens while the frame still moves fast and hides it.
const HANDOVER = 0.28;
// The same swap on the way back. It has to happen before the frame settles:
// the tail of the close covers very little distance, so a crossfade there
// would play out in plain sight next to a nearly still frame.
const CLOSE_HANDOVER = 0.18;

// Documents bring their own viewer, which handles its own pinch.
export const isZoomable = (img: StoredFile | undefined) =>
  !!img && !isPdf(img) && !isOfficeDocument(img);

// Where the frame is on its way between the tile and full size, in its own
// units. At rest that is no offset, a scale of 1 and the frame's own corners.
export interface FrameState {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rx: number;
  ry: number;
  // The scale the picture is drawn at relative to the frame at rest, which the
  // counter scale keeps uniform.
  uniform: number;
}

// The frame interpolates its two axes on its own, so the counter scale has to
// be sampled along that same path. A single pair of keyframes only lines up at
// the two ends and squashes the picture in between.
function counterScaleKeyframes(
  from: { sx: number; sy: number; uniform: number },
  to: { sx: number; sy: number; uniform: number },
): Keyframe[] {
  return Array.from({ length: ZOOM_SAMPLES + 1 }, (_, step) => {
    const progress = step / ZOOM_SAMPLES;
    const frameX = from.sx + (to.sx - from.sx) * progress;
    const frameY = from.sy + (to.sy - from.sy) * progress;
    const uniform = from.uniform + (to.uniform - from.uniform) * progress;

    return {
      offset: progress,
      transform: `scale(${uniform / frameX}, ${uniform / frameY})`,
    };
  });
}

// Where the frame lands: the tile's rect and corners. Tiles are rounded
// differently depending on the grid they sit in, so the corners are read off
// the tile rather than assumed.
export interface TileShape {
  rect: DOMRect;
  radius: number;
}

export function tileShape(tile: HTMLElement): TileShape {
  const radius = parseFloat(getComputedStyle(tile).borderTopLeftRadius);
  return {
    rect: tile.getBoundingClientRect(),
    radius: Number.isFinite(radius) ? radius : THUMB_RADIUS,
  };
}

// The frame is squashed onto the tile, so the image inside it is counter
// scaled back to a uniform ratio. That keeps the picture undistorted while the
// frame crops it exactly like the tile does.
export function openKeyframes(
  { rect: tile, radius }: TileShape,
  frame: DOMRect,
) {
  const sx = tile.width / frame.width;
  const sy = tile.height / frame.height;
  const dx = tile.left + tile.width / 2 - (frame.left + frame.width / 2);
  const dy = tile.top + tile.height / 2 - (frame.top + frame.height / 2);

  return {
    frame: [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        borderRadius: `${radius / sx}px / ${radius / sy}px`,
      },
      {
        transform: 'translate(0px, 0px) scale(1, 1)',
        borderRadius: `${FRAME_RADIUS}px`,
      },
    ],
    inner: counterScaleKeyframes(
      { sx, sy, uniform: Math.max(sx, sy) },
      { sx: 1, sy: 1, uniform: 1 },
    ),
    // The thumbnail covers the frame, so at the tile end it is the tile,
    // pixel for pixel. It hands over to the image mid-flight.
    thumb: [
      { offset: 0, opacity: 1 },
      { offset: HANDOVER, opacity: 0 },
      { offset: 1, opacity: 0 },
    ],
  };
}

// The way into the tile, from wherever the frame is: at rest, still growing
// out of the tile, zoomed in on, or pushed away by the swipe. `frame` is the
// frame's rect with no animation on it. `ancestorScale` is what the zoom and
// the dismiss gesture left on the layers above the frame. The frame's own
// translation and corners are measured on screen but applied underneath that
// scale, so it has to be divided back out or the frame lands off its tile.
export function closeKeyframes(
  { rect: tile, radius }: TileShape,
  frame: DOMRect,
  from: FrameState,
  ancestorScale = 1,
) {
  const sx = tile.width / frame.width;
  const sy = tile.height / frame.height;
  const dx =
    (tile.left + tile.width / 2 - (frame.left + frame.width / 2)) /
    ancestorScale;
  const dy =
    (tile.top + tile.height / 2 - (frame.top + frame.height / 2)) /
    ancestorScale;

  return {
    frame: [
      {
        transform: `translate(${from.dx}px, ${from.dy}px) scale(${from.sx}, ${from.sy})`,
        borderRadius: `${from.rx}px / ${from.ry}px`,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        borderRadius: `${radius / (sx * ancestorScale)}px / ${radius / (sy * ancestorScale)}px`,
      },
    ],
    inner: counterScaleKeyframes(from, { sx, sy, uniform: Math.max(sx, sy) }),
  };
}

// Back to the thumbnail before the frame reaches the tile, so what lands is
// the tile itself rather than an image that has to match it. Not the reverse
// of the open: that would put the crossfade in the slow tail instead of the
// fast opening stretch of the close. It starts from whatever the thumbnail
// shows right now, which after a cut short open may be anything in between.
export function thumbCloseKeyframes(from: number): Keyframe[] {
  return [
    { offset: 0, opacity: from },
    { offset: CLOSE_HANDOVER, opacity: 1 },
    { offset: 1, opacity: 1 },
  ];
}

// The dim at a given strength, 1 being the backdrop at rest. Only the colour
// and the blur are touched: the element's own opacity would take the picture
// down with it, since the picture sits inside the backdrop.
export function dimAt(strength: number) {
  return {
    backgroundColor: `rgba(0, 0, 0, ${DIM_ALPHA * strength})`,
    backdropFilter: `blur(${BLUR_RADIUS * strength}px)`,
    webkitBackdropFilter: `blur(${BLUR_RADIUS * strength}px)`,
  };
}

export function dimKeyframes(): Keyframe[] {
  return [dimAt(0), dimAt(1)];
}

// The alpha of a computed colour: `rgba(r, g, b, a)`, `rgb(r g b / a)` or a
// plain `rgb(...)`, which is opaque.
export function colorAlpha(color: string) {
  if (!color || color === 'transparent') return 0;
  const numbers = color.match(/-?[\d.]+(e-?\d+)?%?/g) ?? [];
  if (numbers.length < 4) return 1;
  const alpha = numbers[3]!;
  return alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
}

// Read off the screen rather than from the animation, so a close that cuts
// into the open, or into a swipe on its way back, starts exactly where the
// frame is drawn.
export function frameState(frame: HTMLElement, inner: HTMLElement): FrameState {
  const f = drawnMatrix(frame);
  const i = drawnMatrix(inner);
  const radius = getComputedStyle(frame)
    .borderTopLeftRadius.split(/\s+/)
    .map((value) => parseFloat(value));
  const rx = Number.isFinite(radius[0]) ? radius[0]! : FRAME_RADIUS;
  const ry = Number.isFinite(radius[1]) ? radius[1]! : rx;

  return {
    dx: f.e,
    dy: f.f,
    sx: f.a || 1,
    sy: f.d || 1,
    rx,
    ry,
    uniform: (i.a || 1) * (f.a || 1),
  };
}
