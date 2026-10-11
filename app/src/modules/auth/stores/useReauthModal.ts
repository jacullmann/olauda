import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * What the confirmation dialog asks for: a way to confirm, or the second
 * factor once Google confirmed the first.
 */
export type ReauthStep = 'choose' | 'google-second-factor';

export const useReauthModal = defineStore('reauth-modal', () => {
  const isOpen = ref(false);
  const step = ref<ReauthStep>('choose');

  let pending: Promise<boolean> | null = null;
  let resolvePending: ((confirmed: boolean) => void) | null = null;

  /**
   * Resolves `true` once the user confirmed and `false` if they cancelled.
   * Requests made while the dialog is up share it, so several protected
   * calls at once ask only once.
   */
  function request(next: ReauthStep = 'choose'): Promise<boolean> {
    if (pending) return pending;
    step.value = next;
    isOpen.value = true;
    pending = new Promise((resolve) => {
      resolvePending = resolve;
    });
    return pending;
  }

  function settle(confirmed: boolean) {
    isOpen.value = false;
    resolvePending?.(confirmed);
    pending = null;
    resolvePending = null;
  }

  return { isOpen, step, request, settle };
});
