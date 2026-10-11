import type { InjectionKey, Ref } from 'vue';

export interface MenuSheetContext {
  activeViewId: Ref<string>;
  pushView: (id: string, label: string) => void;
  popView: () => void;
  submenuTarget: Ref<HTMLElement | null>;
}

export const MENU_SHEET_KEY: InjectionKey<MenuSheetContext> =
  Symbol('MenuSheetContext');
