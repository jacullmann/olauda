<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { Wifi, WifiOff } from '@lucide/vue';
import { useConnectionStatus } from '@/shell/composables/useConnectionStatus';

const { t } = useI18n();
const status = useConnectionStatus();

const isVisible = computed(() => status.value !== 'online');

const appearance = computed(() =>
  status.value === 'offline'
    ? {
        icon: WifiOff,
        label: t('common.connection.offline'),
        colors:
          'bg-surface/80 backdrop-blur-[2px] backdrop-saturate-150 border-ghost-border text-on-ghost',
      }
    : {
        icon: Wifi,
        label: t('common.connection.restored'),
        colors: 'bg-success border-transparent text-on-success',
      },
);

// Measure the inner label (always its natural width), not the clipping wrapper,
// so the wrapper's animated width can never feed back into the measurement.
const labelRef = ref<HTMLElement>();
const { width: labelWidth } = useElementSize(
  labelRef,
  { width: 0, height: 0 },
  { box: 'border-box' },
);

const ICON_SIZE = 18;
// Natural content width: label + icon + gap-2 + pl-2.5 + pr-3 (in spacing units).
const pillWidth = computed(() =>
  labelWidth.value
    ? `calc(${labelWidth.value}px + ${ICON_SIZE}px + var(--spacing) * 7.5)`
    : undefined,
);
</script>

<template>
  <Teleport to="body">
    <!-- The live region stays mounted so screen readers pick up the first
         message; one added together with its content is often not announced. -->
    <div
      role="status"
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+max(--spacing(4),env(safe-area-inset-bottom)))] z-(--z-toast) flex justify-center px-4 print:hidden"
    >
      <Transition
        enter-active-class="transition-[translate,scale,opacity,filter] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        leave-active-class="transition-[translate,scale,opacity,filter] duration-200 ease-in"
        enter-from-class="translate-y-4 scale-90 opacity-0 blur-sm"
        leave-to-class="translate-y-4 scale-90 opacity-0 blur-sm"
      >
        <!-- Wrapper: only the enter/leave animation lives here. -->
        <div v-if="isVisible">
          <!-- Pill: springs to the target width (overshooting) and keeps the
               content centered, so overshoot space splits across both sides. -->
          <div
            class="box-content flex justify-center overflow-hidden rounded-full border shadow-menu transition-[width,color,background-color,border-color,backdrop-filter] duration-[500ms,250ms,250ms,250ms,250ms] ease-[cubic-bezier(0.34,1.56,0.64,1),linear,linear,linear,ease-in]"
            :class="appearance.colors"
            :style="pillWidth ? { width: pillWidth } : undefined"
          >
            <div
              class="flex w-max shrink-0 items-center gap-2 whitespace-nowrap min-h-9 pl-2.5 pr-3 py-2 text-sm/4.5 font-medium"
            >
              <span class="swap-stack shrink-0">
                <Transition name="swap-icon">
                  <component
                    :is="appearance.icon"
                    :size="ICON_SIZE"
                    aria-hidden="true"
                  />
                </Transition>
              </span>
              <!-- Label: eases (no overshoot) to its width, so the icon moves
                   with the spring-vs-ease difference instead of jumping. -->
              <span
                class="overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                :style="labelWidth ? { width: `${labelWidth}px` } : undefined"
              >
                <span ref="labelRef" class="block w-max">{{
                  appearance.label
                }}</span>
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
