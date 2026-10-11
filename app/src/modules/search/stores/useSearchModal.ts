import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SearchMode } from '@/modules/search/types';

export const useSearchModal = defineStore('search-modal', () => {
  const isOpen = ref(false);
  const mode = ref<SearchMode>('default');
  /** Unlike isOpen, stays set while the search animates closed. */
  const isVisible = ref(false);

  function open(nextMode: SearchMode = 'default') {
    mode.value = nextMode;
    isOpen.value = true;
    isVisible.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    if (isOpen.value) close();
    else open();
  }

  /** A search reopened mid-animation is still visible when the old one finishes. */
  function onHidden() {
    isVisible.value = isOpen.value;
  }

  return { isOpen, mode, isVisible, open, close, toggle, onHidden };
});
