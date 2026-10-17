import { onScopeDispose, shallowReactive } from 'vue';
import { useEventListener } from '@vueuse/core';

export interface KeyedSyncOptions<T, V> {
  keyOf: (item: T) => string;
  /**
   * Sets `value` on the server and stores what it confirms. Each request sets
   * the state rather than flipping it, so sending one again is harmless.
   */
  send: (item: T, value: V) => Promise<unknown>;
  /** How long to wait after the last change, so rapid changes send only the last. */
  delay: number;
  /**
   * The server kept `stored`, which shows again. Not called when the user
   * went back to it while the failed request was running.
   */
  onFailed: (item: T, stored: V, error: unknown) => void;
}

interface Entry<T, V> {
  item: T;
  /** What the server holds as far as this sync knows. */
  stored: V;
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  done: Promise<void>;
  finish: () => void;
}

/**
 * Optimistic changes of one value per key, such as a checkbox per task. A
 * change shows at once through `pendingValue`, which views put over the
 * cached state so that a refetch meanwhile cannot undo it. Per key, at most
 * one request runs and only the latest value is sent; requests for one key
 * never overlap, so they cannot arrive out of order. Waiting changes go out
 * right away when the page is hidden or the owner is disposed.
 */
export function useKeyedSync<T, V>(options: KeyedSyncOptions<T, V>) {
  const pending = shallowReactive(new Map<string, V>());
  const entries = new Map<string, Entry<T, V>>();

  const pendingValue = (key: string): V | undefined => pending.get(key);

  /**
   * Shows `value` and syncs it. `shown` is the value before this change, so
   * the server's state as long as nothing is pending. Resolves once the key
   * has nothing left to send.
   */
  function set(item: T, value: V, shown: V): Promise<void> {
    const key = options.keyOf(item);
    let entry = entries.get(key);
    if (!entry) {
      let finish!: () => void;
      const done = new Promise<void>((resolve) => {
        finish = resolve;
      });
      entry = { item, stored: shown, inFlight: false, done, finish };
      entries.set(key, entry);
    }
    entry.item = item;
    pending.set(key, value);
    clearTimeout(entry.timer);
    const scheduled = entry;
    entry.timer = setTimeout(() => void sync(key, scheduled), options.delay);
    return entry.done;
  }

  async function sync(key: string, entry: Entry<T, V>): Promise<void> {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    // The running request syncs again once it is through.
    if (entry.inFlight) return;

    const value = pending.get(key) as V;
    if (value === entry.stored) return end(key, entry);

    entry.inFlight = true;
    let failure: { error: unknown } | undefined;
    try {
      await options.send(entry.item, value);
      entry.stored = value;
    } catch (error) {
      failure = { error };
    }
    entry.inFlight = false;

    if (entries.get(key) !== entry) return;
    if (failure) {
      const wentBack = pending.get(key) === entry.stored;
      end(key, entry);
      if (!wentBack) options.onFailed(entry.item, entry.stored, failure.error);
      return;
    }
    // A change during the request has a timer of its own.
    if (entry.timer === undefined) await sync(key, entry);
  }

  function end(key: string, entry: Entry<T, V>) {
    clearTimeout(entry.timer);
    entries.delete(key);
    pending.delete(key);
    entry.finish();
  }

  /** Sends every waiting change now, as the page may be gone next. */
  function flush() {
    for (const [key, entry] of entries) {
      if (entry.timer !== undefined) void sync(key, entry);
    }
  }

  /** Drops every change without sending it, e.g. once another account signs in. */
  function reset() {
    for (const [key, entry] of entries) end(key, entry);
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  onScopeDispose(flush);

  return { pendingValue, set, reset };
}
