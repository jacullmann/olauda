import {
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from 'vue';

export interface ModalState<TPayload, TResult> {
  isOpen: Ref<boolean>;
  key: Ref<number>;
  payload: ShallowRef<TPayload | null>;
  open: (next: TPayload) => void;
  close: () => void;
  succeed: (result: TResult) => void;
  onSuccess: (listener: (result: TResult) => void) => () => void;
}

/**
 * The state every app-wide modal shares. The payload outlives the close, so a
 * modal can still render it while it animates out. `key` changes on every
 * open, for modals that remount to start from a clean form.
 */
export function useModalState<TPayload = void, TResult = void>(): ModalState<
  TPayload,
  TResult
> {
  const isOpen = ref(false);
  const key = ref(0);
  const payload = shallowRef<TPayload | null>(null);
  const successListeners = new Set<(result: TResult) => void>();

  function open(next: TPayload) {
    payload.value = next;
    key.value += 1;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function succeed(result: TResult) {
    successListeners.forEach((listener) => listener(result));
    close();
  }

  /** Unregisters with the calling component, or through the returned function. */
  function onSuccess(listener: (result: TResult) => void): () => void {
    successListeners.add(listener);
    const unregister = () => successListeners.delete(listener);
    if (getCurrentScope()) onScopeDispose(unregister);
    return unregister;
  }

  return { isOpen, key, payload, open, close, succeed, onSuccess };
}
