import {
  computed,
  onActivated,
  onDeactivated,
  ref,
  toValue,
  unref,
  watch,
  type ComponentPublicInstance,
  type MaybeRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { useEventListener, useResizeObserver } from '@vueuse/core';
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/vue-virtual';

export interface WindowVirtualListOptions {
  /** The element the rows are laid out in; its distance from the page top offsets them. */
  container: Readonly<Ref<HTMLElement | null>>;
  count: MaybeRefOrGetter<number>;
  /** A row's height until it is measured, in px. */
  estimateSize: (index: number) => number;
  /** A new function whenever the rows change, so sizes stay with their rows. */
  getItemKey?: MaybeRef<(index: number) => string | number>;
  /** Rows rendered beyond the visible ones, so fast scrolling shows no gaps. */
  overscan?: number;
  /** Called with the rows in view, including the overscan, whenever they change. */
  onRangeChange?: (startIndex: number, endIndex: number) => void;
}

/**
 * A list scrolled with the page that renders only the rows near the viewport,
 * however long it is. Rows are measured as they render, so they may differ in
 * height and change it later.
 *
 * A list kept alive behind another page keeps its measurements and stops
 * rendering until it returns, so it comes back exactly where it was left.
 */
export function useWindowVirtualList(options: WindowVirtualListOptions) {
  const isActive = ref(true);
  const scrollMargin = ref(0);

  function measureScrollMargin() {
    const el = options.container.value;
    if (!el?.isConnected) return;
    scrollMargin.value = el.getBoundingClientRect().top + window.scrollY;
  }

  // Whatever changes height above the list moves it, and no element's size
  // tells: the page itself is only as high as the viewport. So the offset is
  // measured when the list appears or resizes, and on every scroll and resize
  // of the window, where reading it is cheap as the layout is already done.
  useResizeObserver(options.container, measureScrollMargin);
  useEventListener(window, ['scroll', 'resize'], measureScrollMargin, {
    passive: true,
  });
  onActivated(() => {
    isActive.value = true;
    measureScrollMargin();
  });
  onDeactivated(() => {
    isActive.value = false;
  });

  const virtualizer = useWindowVirtualizer(
    computed(() => ({
      count: toValue(options.count),
      estimateSize: options.estimateSize,
      getItemKey: unref(options.getItemKey),
      overscan: options.overscan ?? 6,
      scrollMargin: scrollMargin.value,
    })),
  );

  const rows = computed<VirtualItem[]>((previous) =>
    previous && !isActive.value
      ? previous
      : virtualizer.value.getVirtualItems(),
  );

  /** Space above the first rendered row, in px. */
  const offsetTop = computed(() =>
    Math.max(
      0,
      (rows.value[0]?.start ?? scrollMargin.value) - scrollMargin.value,
    ),
  );
  /** Space below the last rendered row, in px. */
  const offsetBottom = computed(() =>
    Math.max(
      0,
      virtualizer.value.getTotalSize() -
        ((rows.value.at(-1)?.end ?? scrollMargin.value) - scrollMargin.value),
    ),
  );
  const totalSize = computed(() => virtualizer.value.getTotalSize());

  /** Bind as `:ref` on each row, which also carries `:data-index`. */
  function measureRow(el: Element | ComponentPublicInstance | null) {
    // A row moved out of the page by KeepAlive would measure as zero.
    if (el instanceof Element && el.isConnected) {
      virtualizer.value.measureElement(el);
    }
  }

  watch(rows, (current) => {
    const first = current[0];
    const last = current.at(-1);
    if (isActive.value && first && last) {
      options.onRangeChange?.(first.index, last.index);
    }
  });

  return {
    rows,
    offsetTop,
    offsetBottom,
    totalSize,
    measureRow,
  };
}
