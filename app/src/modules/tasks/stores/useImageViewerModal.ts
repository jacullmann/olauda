import { defineStore } from 'pinia';
import type { StoredFile } from '@/api/files';
import { useModalState } from '@/common/composables/useModalState';

interface ImageViewerPayload {
  images: StoredFile[];
  initialIndex: number;
  /**
   * Resolves the grid tile an image was opened from, so the viewer can grow
   * out of it and shrink back into it.
   */
  origin: ((index: number) => HTMLElement | null) | null;
  /**
   * Opens the context menu of the image on show. The page that owns the
   * images sets it, because the viewer only knows the picture, not what can
   * be done with it.
   */
  menu: ((event: MouseEvent, index: number) => void) | null;
}

export const useImageViewerModal = defineStore('image-viewer-modal', () => {
  const modal = useModalState<ImageViewerPayload>();

  function show(
    images: StoredFile[],
    initialIndex = 0,
    origin: ImageViewerPayload['origin'] = null,
    menu: ImageViewerPayload['menu'] = null,
  ) {
    modal.open({ images, initialIndex, origin, menu });
  }

  return { ...modal, show };
});
