import type { Component } from 'vue';

/** The search's views: the full list, and the pickers some of its items open. */
export type SearchMode =
  'default' | 'group' | 'theme' | 'language' | 'personalization';

/**
 * Decides the hint at the end of an item: an arrow for where a link leads, a
 * chevron and shortcut for an action, a check on the option in effect.
 */
export type SearchItemKind = 'link' | 'action' | 'option';

interface SearchItemDisplay {
  /** Unique within its view. */
  id: string;
  label: string;
  /** The page this item is a subpage of; shown ahead of the label and searchable. */
  parent?: string;
  description?: string;
  icon?: Component;
  avatar?: { name: string; picture?: string | null };
  kind: SearchItemKind;
  shortcut?: string[];
  checked?: boolean;
  /** Too specific for the unfiltered list; only shown once it matches a query. */
  searchOnly?: boolean;
}

/** Either runs once picked, closing the search, or opens another of its views. */
export type SearchItem = SearchItemDisplay &
  ({ run: () => unknown } | { opens: SearchMode });

export interface SearchSection {
  title?: string;
  items: SearchItem[];
}

export interface SearchView {
  title: string;
  placeholder: string;
  sections: SearchSection[];
  /** Heading over the ranked matches; without one they are listed untitled. */
  resultsTitle?: string;
}
