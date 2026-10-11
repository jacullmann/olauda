import type { Component } from 'vue';

/** A row of a settings-style navigation list. */
export interface NavListItem {
  id: string;
  label: string;
  icon: Component;
  count?: number;
  danger?: boolean;
  description?: string;
}
