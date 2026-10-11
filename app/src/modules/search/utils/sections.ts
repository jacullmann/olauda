import { rankByQuery, type SearchField } from '@/common/utils/searchRank';
import type {
  SearchItem,
  SearchSection,
  SearchView,
} from '@/modules/search/types';

function searchFields(item: SearchItem): SearchField[] {
  return [
    { text: item.label, weight: 1 },
    { text: item.parent ?? '', weight: 0.7 },
    { text: item.description ?? '', weight: 0.5 },
  ];
}

/**
 * What `view` lists for `query`. Browsing keeps the view's sections without
 * their search-only items; searching ranks every item into a single section.
 */
export function visibleSections(
  view: SearchView,
  query: string,
): SearchSection[] {
  if (!query.trim()) {
    return view.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.searchOnly),
      }))
      .filter((section) => section.items.length);
  }

  const matches = rankByQuery(
    view.sections.flatMap((section) => section.items),
    query,
    searchFields,
  );
  return matches.length ? [{ title: view.resultsTitle, items: matches }] : [];
}

/** The DOM id of an item's option, for `aria-activedescendant`. */
export function optionElementId(listboxId: string, item: SearchItem): string {
  return `${listboxId}-${item.id}`;
}
