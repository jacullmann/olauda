import { computed, ref, watch, type Ref } from 'vue';
import { useEventListener, useResizeObserver } from '@vueuse/core';

/**
 * A mask that fades a scroller's content out at the bottom while there is more
 * to scroll to. Bind it to `mask-image`.
 */
export function useBottomFadeMask(scroller: Ref<HTMLElement | null>) {
  const showFade = ref(false);

  function update() {
    const el = scroller.value;
    showFade.value =
      !!el && el.scrollHeight - el.scrollTop - el.clientHeight > 1;
  }

  let ticking = false;
  useEventListener(scroller, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  });

  // Content changing height moves the bottom edge without a scroll event.
  const observed = ref<HTMLElement[]>([]);
  watch(
    scroller,
    (el) => {
      observed.value = el
        ? [el, ...Array.from(el.children, (child) => child as HTMLElement)]
        : [];
      update();
    },
    { immediate: true, flush: 'post' },
  );
  useResizeObserver(observed, update);

  const fadeMask = computed(() =>
    showFade.value
      ? 'linear-gradient(to top, transparent 0px, black 32px)'
      : 'none',
  );

  return { fadeMask };
}
