import { computed, ref } from 'vue';
import { useNow } from '@vueuse/core';

/** A countdown in whole seconds that `start()` sets back to `durationMs`. */
export function useCooldown(durationMs: number) {
  const now = useNow({ interval: 1000 });
  const until = ref(0);

  const secondsLeft = computed(() => {
    // `now` ticks once per second, so it can trail `start()` by up to a tick.
    const remainingMs = Math.min(durationMs, until.value - now.value.getTime());
    return Math.max(0, Math.ceil(remainingMs / 1000));
  });

  function start() {
    until.value = Date.now() + durationMs;
  }

  return { secondsLeft, start };
}
