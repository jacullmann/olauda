import { onScopeDispose, ref } from 'vue';

const IDLE_HIDE_MS = 2000;

/** The buttons over the picture, which step aside once the viewer sits idle. */
export function useImageViewerControls() {
  const visible = ref(true);
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  function stopIdleTimer() {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  function show() {
    visible.value = true;
    stopIdleTimer();
    hideTimeout = setTimeout(() => {
      hideTimeout = null;
      visible.value = false;
    }, IDLE_HIDE_MS);
  }

  function hide() {
    stopIdleTimer();
    visible.value = false;
  }

  onScopeDispose(stopIdleTimer);

  return { visible, show, hide, stopIdleTimer };
}

export type ImageViewerControls = ReturnType<typeof useImageViewerControls>;
