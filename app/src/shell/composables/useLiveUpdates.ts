import { computed, onScopeDispose, watch } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';
import { useQueryClient } from '@tanstack/vue-query';
import { API_BASE_URL, refreshSessionOrSignOut } from '@/api/client';
import type { Event as LiveEvent } from '@/api/schema';
import { useSession } from '@/modules/auth/composables/useSession';
import { invalidationsFor } from '@/shell/utils/liveUpdates';

const RETRY_FIRST_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;

/**
 * Keeps everything loaded from the API current while the user is signed in.
 * The server announces what changed, never the change itself, and the
 * affected queries reload through the regular endpoints.
 */
export function useLiveUpdates(): void {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useSession();
  const visibility = useDocumentVisibility();
  // A hidden tab pauses: it would otherwise renew the session forever, e.g.
  // a tab left open on a shared computer, and reload data nobody sees. It
  // catches up through the resync once it shows again.
  const listening = computed(
    () => isLoggedIn.value && visibility.value === 'visible',
  );

  let source: EventSource | null = null;
  let retryDelay = RETRY_FIRST_DELAY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function apply(event: LiveEvent): void {
    for (const filters of invalidationsFor(event)) {
      void queryClient.invalidateQueries(filters);
    }
  }

  /**
   * Whatever loaded before this stream listened may have missed a change,
   * so it reloads; what loads from now on is covered by the stream.
   */
  function resyncFrom(openedAt: number): void {
    void queryClient.invalidateQueries({
      predicate: ({ state }) => state.dataUpdatedAt < openedAt,
    });
  }

  function connect(): void {
    disconnect();
    const stream = new EventSource(`${API_BASE_URL}/events`, {
      withCredentials: true,
    });
    stream.onopen = () => {
      retryDelay = RETRY_FIRST_DELAY_MS;
      resyncFrom(Date.now());
    };
    stream.onmessage = ({ data }: MessageEvent<string>) => {
      try {
        apply(JSON.parse(data) as LiveEvent);
      } catch {
        // A message this version cannot read; the next resync catches up.
      }
    };
    // The browser retries a dropped connection by itself. It gives up only
    // when the server refused the stream, which is an expired access token
    // as long as the session lasts, so it reconnects once that is renewed.
    stream.onerror = () => {
      if (stream.readyState === EventSource.CLOSED) scheduleReconnect();
    };
    source = stream;
  }

  async function reconnect(): Promise<void> {
    try {
      // Signs out app-wide if the session is over, which ends the stream.
      await refreshSessionOrSignOut();
    } catch {
      // Offline or the API restarting: tried again after the next delay.
    }
    if (listening.value) connect();
  }

  function scheduleReconnect(): void {
    disconnect();
    retryTimer = setTimeout(() => void reconnect(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_DELAY_MS);
  }

  function disconnect(): void {
    clearTimeout(retryTimer);
    source?.close();
    source = null;
  }

  watch(
    listening,
    (listen) => {
      retryDelay = RETRY_FIRST_DELAY_MS;
      if (listen) connect();
      else disconnect();
    },
    { immediate: true },
  );
  onScopeDispose(disconnect);
}
