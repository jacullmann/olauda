import {
  computed,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue';

/** AppHeader reduced to a back button and a title, as over an overlay. */
export interface HeaderOverlay {
  title: string;
  back: () => void;
}

type HeaderOverlayGetter = () => HeaderOverlay;

const HEADER_OVERLAY: InjectionKey<ShallowRef<HeaderOverlayGetter | null>> =
  Symbol('headerOverlay');

/** Lets the layout's pages take over its AppHeader. */
export function provideHeaderOverlay() {
  const owner = shallowRef<HeaderOverlayGetter | null>(null);
  provide(HEADER_OVERLAY, owner);
  return computed(() => owner.value?.());
}

/** Shows the page as an overlay in AppHeader for as long as it is mounted. */
export function useHeaderOverlay(overlay: HeaderOverlayGetter) {
  const owner = inject(HEADER_OVERLAY);
  if (!owner) {
    throw new Error('useHeaderOverlay needs a layout that provides AppHeader');
  }
  owner.value = overlay;
  // The next page may already have claimed the header by the time this one
  // unmounts.
  onScopeDispose(() => {
    if (owner.value === overlay) owner.value = null;
  });
}
