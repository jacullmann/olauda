import { computed, ref, watch } from 'vue';
import { useSearchModal } from '@/modules/search/stores/useSearchModal';
import { visibleSections } from '@/modules/search/utils/sections';
import { useActiveItem } from './useActiveItem';
import { useRootSearchView } from './useRootSearchView';
import { usePickerSearchViews } from './usePickerSearchViews';
import type { SearchItem, SearchMode } from '@/modules/search/types';

/**
 * The search's state: the open view, the query filtering it and the item the
 * keyboard points at. Picking an item closes the search through `close`,
 * unless it opens another view.
 */
export function useSearchPalette(close: () => void) {
  const searchModal = useSearchModal();
  const views = { default: useRootSearchView(), ...usePickerSearchViews() };

  const query = ref('');
  const mode = computed(() => searchModal.mode);
  const view = computed(() => views[mode.value].value);
  const isNested = computed(() => mode.value !== 'default');
  const sections = computed(() => visibleSections(view.value, query.value));
  const items = computed(() => sections.value.flatMap(({ items }) => items));

  const { activeItem, moveActive, setActive } = useActiveItem(items);

  watch(mode, () => {
    query.value = '';
  });

  function openView(next: SearchMode) {
    searchModal.mode = next;
  }

  function back() {
    openView('default');
  }

  function select(item: SearchItem) {
    if ('opens' in item) {
      openView(item.opens);
      return;
    }
    close();
    void item.run();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;

    switch (event.key) {
      case 'ArrowDown':
        moveActive(1);
        break;
      case 'ArrowUp':
        moveActive(-1);
        break;
      case 'Enter':
        if (activeItem.value) select(activeItem.value);
        break;
      case 'Backspace':
        if (query.value || !isNested.value) return;
        back();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return {
    query,
    view,
    isNested,
    sections,
    activeItem,
    setActive,
    select,
    back,
    handleKeydown,
  };
}
