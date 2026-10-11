import { readonly, ref, watch, type Ref } from 'vue';
import { useOnline, useTimeoutFn } from '@vueuse/core';

/**
 * `restored` is the short phase after the connection comes back, so the UI
 * can confirm it before settling on `online`.
 */
export type ConnectionStatus = 'online' | 'offline' | 'restored';

const RESTORED_NOTICE_MS = 2500;

/**
 * Tracks the browser's connectivity. `navigator.onLine` is only authoritative
 * when false: true means a network is attached, not that it reaches the server.
 */
export function useConnectionStatus(): Readonly<Ref<ConnectionStatus>> {
  const isOnline = useOnline();
  const status = ref<ConnectionStatus>(isOnline.value ? 'online' : 'offline');

  const { start: scheduleSettle, stop: cancelSettle } = useTimeoutFn(
    () => {
      status.value = 'online';
    },
    RESTORED_NOTICE_MS,
    { immediate: false },
  );

  watch(isOnline, (online) => {
    if (online) {
      status.value = 'restored';
      scheduleSettle();
    } else {
      cancelSettle();
      status.value = 'offline';
    }
  });

  return readonly(status);
}
