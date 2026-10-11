import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSidebarStore = defineStore('sidebar', () => {
  const expanded = ref(false);

  function toggle() {
    expanded.value = !expanded.value;
  }

  return { expanded, toggle };
});
