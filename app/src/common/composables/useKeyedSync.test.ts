import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, type EffectScope } from 'vue';
import { useKeyedSync } from './useKeyedSync';

vi.stubGlobal(
  'document',
  Object.assign(new EventTarget(), { visibilityState: 'visible' }),
);

const DELAY = 400;

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let scope: EffectScope;

function createSync() {
  const send = vi.fn<(key: string, value: boolean) => Promise<unknown>>(() =>
    Promise.resolve(),
  );
  const onFailed = vi.fn();
  scope = effectScope();
  const sync = scope.run(() =>
    useKeyedSync<string, boolean>({
      keyOf: (key) => key,
      delay: DELAY,
      send,
      onFailed,
    }),
  )!;
  return { sync, send, onFailed };
}

describe('useKeyedSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
  });

  it('shows a change at once and sends only the last of quick changes', async () => {
    const { sync, send } = createSync();

    void sync.set('a', true, false);
    void sync.set('a', false, true);
    const done = sync.set('a', true, false);
    expect(sync.pendingValue('a')).toBe(true);
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DELAY);
    await done;

    expect(send).toHaveBeenCalledExactlyOnceWith('a', true);
    expect(sync.pendingValue('a')).toBeUndefined();
  });

  it('sends nothing when the changes end where they started', async () => {
    const { sync, send } = createSync();

    void sync.set('a', true, false);
    const done = sync.set('a', false, true);
    await vi.advanceTimersByTimeAsync(DELAY);
    await done;

    expect(send).not.toHaveBeenCalled();
  });

  it('waits for the running request before sending a newer value', async () => {
    const { sync, send } = createSync();
    const first = deferred();
    send.mockReturnValueOnce(first.promise);

    const done = sync.set('a', true, false);
    await vi.advanceTimersByTimeAsync(DELAY);
    void sync.set('a', false, true);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(send).toHaveBeenCalledTimes(1);

    first.resolve();
    await done;

    expect(send.mock.calls).toEqual([
      ['a', true],
      ['a', false],
    ]);
    expect(sync.pendingValue('a')).toBeUndefined();
  });

  it('shows the stored value again and reports a failed change', async () => {
    const { sync, send, onFailed } = createSync();
    const error = new Error('offline');
    send.mockRejectedValueOnce(error);

    const done = sync.set('a', true, false);
    await vi.advanceTimersByTimeAsync(DELAY);
    await done;

    expect(sync.pendingValue('a')).toBeUndefined();
    expect(onFailed).toHaveBeenCalledExactlyOnceWith('a', false, error);
  });

  it('stays silent about a failure the user already undid', async () => {
    const { sync, send, onFailed } = createSync();
    const request = deferred();
    send.mockReturnValueOnce(request.promise);

    const done = sync.set('a', true, false);
    await vi.advanceTimersByTimeAsync(DELAY);
    void sync.set('a', false, true);
    request.reject(new Error('offline'));
    await done;

    expect(onFailed).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends waiting changes right away when the page is hidden', async () => {
    const { sync, send } = createSync();

    const done = sync.set('a', true, false);
    Object.assign(document, { visibilityState: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.assign(document, { visibilityState: 'visible' });
    await done;

    expect(send).toHaveBeenCalledExactlyOnceWith('a', true);
  });

  it('drops waiting changes on reset without sending them', async () => {
    const { sync, send } = createSync();

    const done = sync.set('a', true, false);
    sync.reset();
    await done;
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(send).not.toHaveBeenCalled();
    expect(sync.pendingValue('a')).toBeUndefined();
  });
});
