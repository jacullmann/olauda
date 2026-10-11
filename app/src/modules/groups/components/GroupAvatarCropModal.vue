<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ZoomIn, ZoomOut } from '@lucide/vue';

const props = defineProps<{
  open: boolean;
  imageSrc: string;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'confirm', croppedBlob: Blob): void;
}>();

const { t } = useI18n();

const originalWidth = ref(0);
const originalHeight = ref(0);
const zoom = ref(1.0);
const x = ref(0);
const y = ref(0);
const processing = ref(false);

const boxSize = 320;
const cropSize = 224;

const minScale = computed(() => {
  if (originalWidth.value === 0 || originalHeight.value === 0) return 1;
  return Math.max(
    cropSize / originalWidth.value,
    cropSize / originalHeight.value,
  );
});

const scale = computed(() => zoom.value * minScale.value);
const imgW = computed(() => originalWidth.value * scale.value);
const imgH = computed(() => originalHeight.value * scale.value);

const imgStyle = computed(() => {
  return {
    width: `${imgW.value}px`,
    height: `${imgH.value}px`,
    transform: `translate3d(${(boxSize - imgW.value) / 2 + x.value}px, ${(boxSize - imgH.value) / 2 + y.value}px, 0)`,
    maxWidth: 'none',
    maxHeight: 'none',
  };
});

function clampPosition() {
  const maxX = Math.max(0, (imgW.value - cropSize) / 2);
  const maxY = Math.max(0, (imgH.value - cropSize) / 2);
  x.value = Math.max(-maxX, Math.min(maxX, x.value));
  y.value = Math.max(-maxY, Math.min(maxY, y.value));
}

watch(scale, () => {
  clampPosition();
});

watch(
  () => props.imageSrc,
  (newSrc) => {
    if (!newSrc) return;
    const img = new Image();
    img.onload = () => {
      originalWidth.value = img.naturalWidth;
      originalHeight.value = img.naturalHeight;
      zoom.value = 1.0;
      x.value = 0;
      y.value = 0;
      clampPosition();
    };
    img.src = newSrc;
  },
  { immediate: true },
);

let isDragging = false;
let startMouseX = 0;
let startMouseY = 0;
let startX = 0;
let startY = 0;

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  isDragging = true;
  startMouseX = e.clientX;
  startMouseY = e.clientY;
  startX = x.value;
  startY = y.value;
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging) return;
  const dx = e.clientX - startMouseX;
  const dy = e.clientY - startMouseY;
  x.value = startX + dx;
  y.value = startY + dy;
  clampPosition();
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging) return;
  isDragging = false;
  const el = e.currentTarget as HTMLElement;
  try {
    el.releasePointerCapture(e.pointerId);
  } catch {
    // Capture is already released when the pointer left the element.
  }
}

function onWheel(e: WheelEvent) {
  const delta = -e.deltaY * 0.003;
  zoom.value = Math.max(1.0, Math.min(4.0, zoom.value + delta));
}

function applyCrop() {
  if (processing.value || !props.imageSrc) return;
  processing.value = true;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      processing.value = false;
      return;
    }

    canvas.width = 512;
    canvas.height = 512;

    const cropXImg = (imgW.value - cropSize) / 2 - x.value;
    const cropYImg = (imgH.value - cropSize) / 2 - y.value;

    const sourceX = cropXImg / scale.value;
    const sourceY = cropYImg / scale.value;
    const sourceSize = cropSize / scale.value;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      512,
      512,
    );

    canvas.toBlob(
      (blob) => {
        processing.value = false;
        if (blob) {
          emit('confirm', blob);
        }
      },
      'image/jpeg',
      0.9,
    );
  };
  img.src = props.imageSrc;
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="applyCrop"
    :loading="processing"
    @cancel="emit('cancel')"
  >
    <template #title>
      {{ t('groups.settings.general.avatar.cropper.title') }}
    </template>

    <template #content>
      <div class="flex flex-col items-center gap-6 py-2 select-none">
        <div
          class="relative w-80 h-80 rounded-2xl bg-zinc-950/80 border border-white/10 overflow-hidden cursor-move touch-none"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
        >
          <img
            :src="imageSrc"
            :alt="t('groups.settings.general.avatar.cropper.image_alt')"
            class="absolute pointer-events-none origin-top-left"
            :style="imgStyle"
          />

          <svg
            class="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 320 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 0H320V320H0V0ZM160 272C221.858 272 272 221.858 272 160C272 98.1421 221.858 48 160 48C98.1421 48 48 98.1421 48 160C48 221.858 98.1421 272 160 272Z"
              fill="rgba(9, 9, 11, 0.72)"
              fill-rule="evenodd"
            />
            <circle
              cx="160"
              cy="160"
              r="112"
              stroke="rgba(255, 255, 255, 0.45)"
              stroke-width="1"
            />
          </svg>
        </div>

        <div class="flex items-center gap-3 w-full max-w-70">
          <ZoomOut class="w-4 h-4 text-on-ghost-muted" />
          <input
            v-model.number="zoom"
            type="range"
            min="1.0"
            max="4.0"
            step="0.001"
            class="flex-1 cursor-pointer h-1.5 bg-white/10 hover:bg-white/15 rounded-lg appearance-none accent-action"
          />
          <ZoomIn class="w-4 h-4 text-on-ghost-muted" />
        </div>

        <p class="text-xs text-on-ghost-muted text-center m-0">
          {{ t('groups.settings.general.avatar.cropper.hint') }}
        </p>
      </div>
    </template>

    <template #action-text>
      {{ t('common.buttons.save') || 'Speichern' }}
    </template>
  </BaseModal>
</template>
