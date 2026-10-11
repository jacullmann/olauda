import { ref, computed } from 'vue';

const progress = ref(0);
const isLoading = ref(false);
const opacity = ref(1);

let timer: ReturnType<typeof setInterval> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const STEP_INTERVAL = 200;
const FADE_DELAY = 300;
const HIDE_DELAY = 400;

// A navigation that starts while the last one fades out must not be hidden
// by that fade.
function clearFinishTimers() {
  if (fadeTimer) clearTimeout(fadeTimer);
  if (hideTimer) clearTimeout(hideTimer);
  fadeTimer = null;
  hideTimer = null;
}

export function useLoadingBar() {
  const start = () => {
    if (timer) clearInterval(timer);
    clearFinishTimers();

    progress.value = 0;
    opacity.value = 1;
    isLoading.value = true;

    timer = setInterval(() => {
      increment();
    }, STEP_INTERVAL);
  };

  const increment = () => {
    if (progress.value >= 95) return;

    let amount = 0;
    if (progress.value >= 0 && progress.value < 20) {
      amount = 10;
    } else if (progress.value >= 20 && progress.value < 50) {
      amount = 4;
    } else if (progress.value >= 50 && progress.value < 80) {
      amount = 2;
    } else {
      amount = 0.5;
    }

    progress.value = Math.min(progress.value + amount, 99.4);
  };

  const finish = () => {
    if (timer) clearInterval(timer);
    timer = null;
    clearFinishTimers();

    progress.value = 100;

    fadeTimer = setTimeout(() => {
      opacity.value = 0;
      hideTimer = setTimeout(() => {
        isLoading.value = false;
        progress.value = 0;
        opacity.value = 1;
      }, HIDE_DELAY);
    }, FADE_DELAY);
  };

  return {
    loading: computed(() => isLoading.value),
    progress: computed(() => progress.value),
    opacity: computed(() => opacity.value),
    start,
    finish,
  };
}
