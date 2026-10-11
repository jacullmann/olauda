import { onBeforeUnmount, watchEffect, type Ref } from 'vue';
import { useElementSize } from '@vueuse/core';

/**
 * Publishes the bar's height as `--tab-bar-height`, which pages pad their
 * bottom by, so nothing ends up permanently behind the bar. Measured rather
 * than derived from tokens: the bar's height depends on the device's safe
 * area and the user's font size.
 */
export function useTabBarHeight(barEl: Ref<HTMLElement | null>) {
  const { height } = useElementSize(
    barEl,
    { width: 0, height: 0 },
    { box: 'border-box' },
  );

  watchEffect(() => {
    document.documentElement.style.setProperty(
      '--tab-bar-height',
      `${height.value}px`,
    );
  });

  onBeforeUnmount(() => {
    document.documentElement.style.removeProperty('--tab-bar-height');
  });
}
