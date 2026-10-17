import { ref, computed, nextTick, type Ref, type CSSProperties } from 'vue';
import { useRouter } from 'vue-router';
import { useEventListener, useElementBounding } from '@vueuse/core';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { useIsMobileViewport } from '@/common/composables/useViewport';

export function useAccountMenu(
  emit: (event: 'logout') => void,
  refs: {
    root: Ref<HTMLElement | null>;
    popupInner: Ref<HTMLElement | null>;
    firstMenuBtnRef: Ref<{ focus: () => void } | null>;
    baseMenu: Ref<{ startClose: () => void } | null>;
  },
) {
  const router = useRouter();

  const open = ref(false);

  const triggerEl = computed(() => refs.root.value);
  const menuEl = computed(() => refs.popupInner.value);

  const { floatingStyles, isPositioned } = useFloating(triggerEl, menuEl, {
    strategy: 'fixed',
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    transform: false,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  const { width: popupW } = useElementBounding(refs.popupInner);

  const isMobile = useIsMobileViewport();

  const popupStyle = computed<CSSProperties>(() => {
    if (!open.value) return {};
    if (isMobile.value) return {};

    const width = Math.min(300, popupW.value || 300);

    return {
      ...floatingStyles.value,
      width: `${width}px`,
      opacity: isPositioned.value ? undefined : 0,
    };
  });

  function cancel() {
    open.value = false;
  }

  function closeAnimated() {
    if (isMobile.value && refs.baseMenu.value) {
      refs.baseMenu.value.startClose();
    } else {
      cancel();
    }
  }

  function handleLogout() {
    emit('logout');
    closeAnimated();
  }

  function openAccountSettings() {
    void router.push({ name: 'account-settings' });
    closeAnimated();
  }

  async function toggle(e?: Event) {
    if (open.value) {
      closeAnimated();
    } else {
      open.value = true;
      if (
        e &&
        (e.type === 'keydown' ||
          (e as KeyboardEvent).key === 'Enter' ||
          (e as KeyboardEvent).key === ' ')
      ) {
        await nextTick();
        refs.firstMenuBtnRef.value?.focus();
      } else if (
        e?.type === 'click' &&
        (e as PointerEvent).pointerType === ''
      ) {
        await nextTick();
        refs.firstMenuBtnRef.value?.focus();
      }
    }
  }

  useEventListener(document, 'pointerdown', (e: PointerEvent) => {
    if (!open.value) return;
    const target = e.target as Node;
    if (refs.root.value?.contains(target)) return;
    if (isMobile.value) return;
    cancel();
  });

  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeAnimated();
  });

  return {
    isMobile,
    open,
    popupStyle,
    handleLogout,
    openAccountSettings,
    toggle,
    cancel,
  };
}
