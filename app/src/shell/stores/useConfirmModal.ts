import { defineStore } from 'pinia';
import { ref } from 'vue';
import i18n from '@/i18n';

export interface ConfirmOptions {
  title: string;
  content: string;
  submitText?: string;
  danger?: boolean;
}

export const useConfirmModal = defineStore('confirm-modal', () => {
  const isOpen = ref(false);
  const options = ref<Required<ConfirmOptions>>({
    title: '',
    content: '',
    submitText: i18n.global.t('common.buttons.confirm'),
    danger: false,
  });

  let resolvePending: ((confirmed: boolean) => void) | null = null;

  function ask(next: ConfirmOptions): Promise<boolean> {
    // A dialog replaced by a newer one counts as dismissed.
    resolvePending?.(false);
    options.value = {
      title: next.title,
      content: next.content,
      submitText: next.submitText ?? i18n.global.t('common.buttons.confirm'),
      danger: next.danger ?? false,
    };
    isOpen.value = true;

    return new Promise((resolve) => {
      resolvePending = resolve;
    });
  }

  function answer(confirmed: boolean) {
    isOpen.value = false;
    resolvePending?.(confirmed);
    resolvePending = null;
  }

  return { isOpen, options, ask, answer };
});
