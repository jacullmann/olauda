<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  type ComponentPublicInstance,
} from 'vue';
import { useWindowSize } from '@vueuse/core';
import { X, Ellipsis, ChevronLeft, ChevronRight } from '@lucide/vue';
import {
  fileUrl,
  isOfficeDocument,
  isPdf,
  previewUrl,
  type StoredFile,
} from '@/api/files';
import {
  FRAME_RADIUS,
  isZoomable,
} from '@/modules/tasks/utils/imageViewerMotion';
import { useImageViewerControls } from '@/modules/tasks/composables/useImageViewerControls';
import { useImageViewerDismiss } from '@/modules/tasks/composables/useImageViewerDismiss';
import { useImageViewerGestures } from '@/modules/tasks/composables/useImageViewerGestures';
import { useImageViewerTrack } from '@/modules/tasks/composables/useImageViewerTrack';
import { useImageViewerTransition } from '@/modules/tasks/composables/useImageViewerTransition';
import { useImageViewerZoom } from '@/modules/tasks/composables/useImageViewerZoom';

const props = defineProps<{
  visible: boolean;
  images: StoredFile[];
  initialIndex: number;
  // Resolves the grid tile an image was opened from, so the viewer can grow
  // out of it and shrink back into it.
  origin?: ((index: number) => HTMLElement | null) | null;
  // Opens the context menu of the image on show. The viewer only knows the
  // image, so the page that owns it says what the menu does with it. Without
  // this there is no menu button.
  menu?: ((event: MouseEvent, index: number) => void) | null;
}>();

const emit = defineEmits<{ cancel: [] }>();

// The backdrop padding, which bounds the image box.
const VIEWPORT_PADDING = 16;

const currentIndex = ref(props.initialIndex);
const overlayRef = ref<ComponentPublicInstance | null>(null);
// Keyed by image index: the viewer keeps the neighbours mounted for the slide,
// and each of them loads and measures on its own.
const loadedSlides = ref<Record<number, boolean>>({});
const measuredSizes = ref<Record<number, { w: number; h: number }>>({});
let pendingSize: { index: number; w: number; h: number } | null = null;

const { width: windowWidth, height: windowHeight } = useWindowSize();
const viewport = { width: windowWidth, height: windowHeight };

const backdropEl = () => overlayRef.value?.$el as HTMLElement | undefined;

function focusOverlay() {
  backdropEl()?.focus();
}

const controls = useImageViewerControls();
const zoom = useImageViewerZoom({ currentIndex, viewport, root: backdropEl });
const dismiss = useImageViewerDismiss({ viewport });
const track = useImageViewerTrack({
  currentIndex,
  count: () => props.images.length,
  viewportWidth: windowWidth,
  hidesNeighbours: () => dismiss.active.value,
  // An image zoomed in on keeps its zoom until it has left the screen.
  onSettled: () => {
    if (zoom.zoomedIndex.value !== currentIndex.value) zoom.reset();
  },
  onTurn: focusOverlay,
});
const transition = useImageViewerTransition({
  originTile,
  fullLoaded: () => !!loadedSlides.value[currentIndex.value],
  controls,
  onOpened: (completed) => {
    if (completed && pendingSize) {
      measuredSizes.value[pendingSize.index] = {
        w: pendingSize.w,
        h: pendingSize.h,
      };
    }
    pendingSize = null;
  },
});
const gestures = useImageViewerGestures({
  currentIndex,
  viewport,
  track,
  zoom,
  dismiss,
  controls,
  canZoom: () => isZoomable(props.images[currentIndex.value]),
  onDismissStart: () => {
    const dim = transition.interruptOpenDim(backdropEl());
    if (dim !== null) dismiss.openDim.value = dim;
  },
  onDismiss: cancel,
});

const { visible: controlsVisible } = controls;
const { trackRef, slides, trackStyle, slideStyle, hasNext, hasPrev } = track;
const { zoomedIndex, zoomStyle, zoomedAt } = zoom;
const { stageStyle, backdropStyle } = dismiss;

function getOfficeViewerSrc(img: StoredFile): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl(img))}`;
}

// The thumbnail is already in the browser cache, so it stands in for the full
// image while that one loads and the zoom runs.
function thumbSrc(img: StoredFile): string | undefined {
  return previewUrl(img) ?? undefined;
}

// Only a known aspect ratio lets the final frame be laid out before the full
// image arrives, which is what the zoom animates towards. The stored size
// can disagree with what the image really is, for example when it was rotated
// on delivery, so the loaded image corrects it.
function naturalSize(index: number) {
  const measured = measuredSizes.value[index];
  if (measured) return measured;

  const image = props.images[index];
  const w = image?.width ?? 0;
  const h = image?.height ?? 0;
  return w > 0 && h > 0 ? { w, h } : null;
}

function frameSize(index: number) {
  const natural = naturalSize(index);
  if (!natural) return null;

  const availableW = Math.max(0, windowWidth.value - VIEWPORT_PADDING * 2);
  const availableH = Math.max(0, windowHeight.value - VIEWPORT_PADDING * 2);
  // Matches max-w-full/max-h-full: contain, never upscaled.
  const scale = Math.min(availableW / natural.w, availableH / natural.h, 1);

  return { w: natural.w * scale, h: natural.h * scale };
}

function frameStyle(index: number) {
  const size = frameSize(index);
  if (!size) return undefined;

  return {
    width: `${size.w}px`,
    height: `${size.h}px`,
    // The zoom scales the corners along with the picture, so they are
    // counter scaled to stay the size they are at rest.
    borderRadius: zoomedAt(index)
      ? `${FRAME_RADIUS / zoom.scale.value}px`
      : undefined,
  };
}

const currentFrameSize = computed(() => frameSize(currentIndex.value));

// The tile to grow out of, or null when there is nothing sensible to grow
// from: no origin, a missing tile, or one scrolled out of the viewport.
function originTile(): HTMLElement | null {
  if (!currentFrameSize.value) return null;

  const el = props.origin?.(currentIndex.value) ?? null;
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return null;

  return el;
}

function onBackdropClick() {
  // The tap that ends a drag is the drag's, not a close.
  if (gestures.endedRecently()) return;
  cancel();
}

function cancel() {
  emit('cancel');
}

function openMenu(event: MouseEvent) {
  props.menu?.(event, currentIndex.value);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // A modal the viewer was opened from closes on any Escape that reaches the
    // window, and this one is only meant for the viewer.
    e.stopPropagation();
    cancel();
  }
  if (e.key === 'ArrowRight') track.next();
  if (e.key === 'ArrowLeft') track.prev();
}

function onFullLoad(event: Event, index: number) {
  const img = event.target as HTMLImageElement;
  loadedSlides.value[index] = true;

  if (!img.naturalWidth || !img.naturalHeight) return;

  const natural = naturalSize(index);
  const loaded = { w: img.naturalWidth, h: img.naturalHeight };
  const matches =
    natural && Math.abs(natural.w / natural.h - loaded.w / loaded.h) < 0.01;

  if (matches) return;

  // The frame is the wrong shape for this image, so the picture would sit in
  // it with a margin that the tile does not have. Resize it, but not while the
  // zoom is running off the rect it started with.
  if (transition.isZooming() && index === currentIndex.value) {
    pendingSize = { index, ...loaded };
  } else {
    measuredSizes.value[index] = loaded;
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      currentIndex.value = props.initialIndex;
      loadedSlides.value = {};
      measuredSizes.value = {};
      pendingSize = null;
      track.reset();
      dismiss.reset();
      zoom.reset();
      gestures.reset();
      // The controls arrive with the frame, driven by the open animation, so
      // they are up from the first render and start out transparent.
      controlsVisible.value = true;
      document.body.style.overflow = 'hidden';
      void nextTick(focusOverlay);
    } else {
      document.body.style.overflow = '';
    }
  },
);
</script>

<template>
  <Transition
    :css="false"
    @enter="transition.onEnter"
    @leave="transition.onLeave"
  >
    <BaseBackdrop
      v-if="visible"
      ref="overlayRef"
      class="z-[100002] p-4"
      :style="backdropStyle"
      tabindex="0"
      @mousemove="controls.show()"
      @cancel="cancel"
      @touchstart="controls.show()"
      @keydown="handleKeydown"
    >
      <div
        class="w-full h-full touch-pan-y"
        @click.self="onBackdropClick"
        @touchstart.passive="gestures.onTouchStart"
        @touchmove="gestures.onTouchMove"
        @touchend="gestures.onTouchEnd"
        @touchcancel="gestures.onTouchEnd"
      >
        <!-- Pushed away as one piece by the downward swipe, so the track
             underneath only ever deals with the horizontal offset. -->
        <div
          data-viewer-stage
          class="absolute inset-0 will-change-transform"
          :style="stageStyle"
        >
          <!-- Every mounted image keeps its own place on the track, and the
               track is what the gesture and the keyboard move. -->
          <div
            ref="trackRef"
            data-viewer-track
            class="absolute inset-0 will-change-transform"
            :style="trackStyle"
          >
            <div
              v-for="index in slides"
              :key="index"
              class="absolute inset-0"
              :style="slideStyle(index)"
            >
              <!-- Covers the whole slide, so the zoom scales around the
                   viewport centre. -->
              <div
                v-if="images[index]"
                :data-viewer-zoom="index === zoomedIndex ? '' : null"
                class="absolute inset-0 flex items-center justify-center"
                :style="zoomStyle(index)"
                @click.self="onBackdropClick"
              >
                <iframe
                  v-if="isOfficeDocument(images[index])"
                  :src="getOfficeViewerSrc(images[index])"
                  class="w-[90vw] h-[85vh] max-w-5xl rounded-xl border-none bg-white"
                  @click.stop
                ></iframe>
                <iframe
                  v-else-if="isPdf(images[index])"
                  :src="fileUrl(images[index])"
                  class="w-[90vw] h-[85vh] max-w-5xl rounded-xl border-none bg-white"
                  @click.stop
                ></iframe>
                <!-- A layer promoted with will-change keeps the resolution it
                     was first drawn at, which would leave a zoomed in picture
                     blurry, so it is only promoted at rest. -->
                <div
                  v-else-if="frameSize(index)"
                  :data-viewer-frame="index === currentIndex ? '' : null"
                  class="relative max-w-full max-h-full overflow-hidden rounded-xl"
                  :class="{ 'will-change-transform': !zoomedAt(index) }"
                  :style="frameStyle(index)"
                  @click.stop
                >
                  <div
                    :data-viewer-inner="index === currentIndex ? '' : null"
                    class="absolute inset-0"
                    :class="{ 'will-change-transform': !zoomedAt(index) }"
                  >
                    <img
                      :src="fileUrl(images[index])"
                      class="absolute inset-0 w-full h-full object-contain"
                      draggable="false"
                      alt=""
                      @load="onFullLoad($event, index)"
                    />
                  </div>

                  <!-- Sits on top of the image and outside the counter scaled
                   layer. object-fill, because the frame is squashed onto the
                   tile at that end of the zoom and the two stretches cancel
                   out: the square thumbnail then lands on the tile exactly as
                   the tile draws it. That is what makes the handover
                   invisible. -->
                  <img
                    v-if="thumbSrc(images[index])"
                    :src="thumbSrc(images[index])"
                    :data-viewer-thumb="index === currentIndex ? '' : null"
                    class="absolute inset-0 w-full h-full object-fill transition-opacity duration-200 ease-out"
                    :class="loadedSlides[index] ? 'opacity-0' : 'opacity-100'"
                    draggable="false"
                    aria-hidden="true"
                    alt=""
                  />
                </div>
                <img
                  v-else
                  :src="fileUrl(images[index])"
                  class="max-w-full max-h-full rounded-xl object-contain"
                  draggable="false"
                  alt=""
                  @click.stop
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Transition name="fade-controls">
        <div
          v-show="controlsVisible"
          data-viewer-controls
          class="fixed inset-0 pointer-events-none"
        >
          <!-- On a phone the close button sits where the thumb reaches it and
               leaves the corner it came from to the menu. -->
          <button
            v-wave
            class="absolute top-4 left-4 md:left-auto md:right-4 pointer-events-auto bg-black/60 border-none text-white cursor-pointer p-2 rounded-full flex items-center justify-center transition-colors hover:bg-black/40 active:bg-black/40 backdrop-blur-xs"
            @click.stop="cancel"
          >
            <X />
          </button>

          <button
            v-if="menu"
            v-wave
            class="absolute top-4 right-4 md:hidden pointer-events-auto bg-black/60 border-none text-white cursor-pointer p-2 rounded-full flex items-center justify-center transition-colors hover:bg-black/40 active:bg-black/40 backdrop-blur-xs"
            @click.stop="openMenu"
          >
            <Ellipsis />
          </button>

          <!-- A pointer has no swipe, so the arrows stay on the desktop. -->
          <button
            v-if="hasPrev"
            v-wave
            class="absolute top-1/2 left-4 -translate-y-1/2 pointer-events-auto bg-black/60 border-none text-white cursor-pointer p-2 rounded-full hidden md:flex items-center justify-center transition-colors hover:bg-black/40 active:bg-black/40 backdrop-blur-xs"
            @click.stop="track.prev()"
          >
            <ChevronLeft />
          </button>

          <button
            v-if="hasNext"
            v-wave
            class="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-auto bg-black/60 border-none text-white cursor-pointer p-2 rounded-full hidden md:flex items-center justify-center transition-colors hover:bg-black/40 active:bg-black/40 backdrop-blur-xs"
            @click.stop="track.next()"
          >
            <ChevronRight />
          </button>

          <div
            class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/60 px-3 py-1 rounded-full text-sm backdrop-blur-xs pointer-events-auto"
            @click.stop
          >
            {{ currentIndex + 1 }} / {{ images.length }}
          </div>
        </div>
      </Transition>
    </BaseBackdrop>
  </Transition>
</template>

<style scoped>
.fade-controls-enter-active,
.fade-controls-leave-active {
  transition: opacity 0.3s ease;
}
.fade-controls-enter-from,
.fade-controls-leave-to {
  opacity: 0;
}
</style>
