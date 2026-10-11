<script setup lang="ts">
import {
  computed,
  ref,
  provide,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from 'vue';
import { useEventListener } from '@vueuse/core';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import { ChevronLeft } from '@lucide/vue';
import { MENU_SHEET_KEY } from '@/common/utils/menuSheet';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    open?: boolean;
    desktopTransition?: string;
    /** Shown as a sticky heading at the top of the mobile sheet. */
    title?: string;
    /** Opens the mobile sheet above a fullscreen overlay; see BaseSheet. */
    elevated?: boolean;
  }>(),
  {
    open: true,
    desktopTransition: 'fade-dropdown',
    elevated: false,
  },
);

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'close'): void;
  (e: 'after-leave'): void;
}>();

const isMobile = useIsMobileViewport();

const desktopMenuCardRef = ref<{ menuEl: HTMLElement | null } | null>(null);
const sheetComponentRef = ref<{ sheetEl: HTMLElement | null } | null>(null);

const desktopMenuEl = computed(() => desktopMenuCardRef.value?.menuEl || null);
const sheetEl = computed(() => sheetComponentRef.value?.sheetEl || null);

function startClose() {
  emit('cancel');
  emit('close');
}

useEventListener(window, 'pointerdown', (e: PointerEvent) => {
  if (!props.open || isMobile.value || !desktopMenuEl.value) return;

  const target = e.target as Node | null;
  if (target && !desktopMenuEl.value.contains(target)) {
    startClose();
  }
});

useEventListener(window, 'contextmenu', (e: MouseEvent) => {
  if (
    props.open &&
    !isMobile.value &&
    desktopMenuEl.value &&
    !desktopMenuEl.value.contains(e.target as Node)
  ) {
    startClose();
  }
});

useEventListener(
  window,
  'scroll',
  (e: Event) => {
    if (!props.open || isMobile.value) return;

    // Ignore scroll events originating from within the menu itself
    if (desktopMenuEl.value && desktopMenuEl.value.contains(e.target as Node)) {
      return;
    }

    startClose();
  },
  { capture: true, passive: true },
);

interface StackEntry {
  id: string;
  label: string;
}

const viewStack = ref<StackEntry[]>([{ id: 'root', label: '' }]);
const activeViewId = computed(() => viewStack.value.at(-1)!.id);
const isAtRoot = computed(() => viewStack.value.length <= 1);
const sheetTitle = computed(() =>
  isAtRoot.value ? props.title : viewStack.value.at(-1)!.label || props.title,
);
const submenuTarget = ref<HTMLElement | null>(null);

function pushView(id: string, label: string) {
  viewStack.value = [...viewStack.value, { id, label }];
}
function popView() {
  if (viewStack.value.length > 1) {
    viewStack.value = viewStack.value.slice(0, -1);
  }
}

provide(MENU_SHEET_KEY, { activeViewId, pushView, popView, submenuTarget });

const menuHeight = ref<number | 'auto'>('auto');
const rootViewEl = ref<HTMLElement | null>(null);
const subViewEl = ref<HTMLElement | null>(null);

watch(activeViewId, async (newId, oldId) => {
  if (!isMobile.value) return;
  if (newId === oldId || !props.open) return;

  const container = rootViewEl.value?.parentElement;
  if (!container || !rootViewEl.value || !subViewEl.value) return;

  const startHeight = container.getBoundingClientRect().height;
  menuHeight.value = startHeight;

  void container.offsetHeight;

  await nextTick();

  requestAnimationFrame(() => {
    const targetEl = newId === 'root' ? rootViewEl.value : subViewEl.value;
    if (targetEl) {
      const targetHeight = targetEl.getBoundingClientRect().height;
      menuHeight.value = targetHeight;

      setTimeout(() => {
        if (menuHeight.value === targetHeight) {
          menuHeight.value = 'auto';
        }
      }, 350);
    }
  });
});

watch(
  () => props.open,
  (newOpen) => {
    if (!isMobile.value) return;
    if (!newOpen) {
      setTimeout(() => {
        viewStack.value = [{ id: 'root', label: '' }];
        menuHeight.value = 'auto';
      }, 300);
    }
  },
);

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return;

  if (e.key === 'Escape') {
    startClose();
    return;
  }

  const target = e.target as HTMLElement;
  const isMenuInteraction =
    (desktopMenuEl.value && desktopMenuEl.value.contains(target)) ||
    (sheetEl.value && sheetEl.value.contains(target));

  if (!isMenuInteraction) return;

  const menuContainer = isMobile.value ? sheetEl.value : desktopMenuEl.value;
  if (!menuContainer) return;

  const focusableSelectors =
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const allFocusableElements = Array.from(
    menuContainer.querySelectorAll<HTMLElement>(focusableSelectors),
  );

  const focusableElements = allFocusableElements.filter((el) => {
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

    if (isMobile.value) {
      const inRootView = rootViewEl.value?.contains(el);
      const inSubView = subViewEl.value?.contains(el);
      if (activeViewId.value === 'root' && inSubView) return false;
      if (activeViewId.value !== 'root' && inRootView) return false;
    }
    return true;
  });

  if (focusableElements.length === 0) return;

  const currentIndex = focusableElements.indexOf(target);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIndex =
      currentIndex === -1 || currentIndex === focusableElements.length - 1
        ? 0
        : currentIndex + 1;
    focusableElements[nextIndex]?.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const nextIndex =
      currentIndex === -1 || currentIndex === 0
        ? focusableElements.length - 1
        : currentIndex - 1;
    focusableElements[nextIndex]?.focus();
  }
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      document.addEventListener('keydown', handleKeydown);
    } else {
      document.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

const desktopScrollEl = ref<HTMLElement | null>(null);
const mobileScrollEl = ref<HTMLElement | null>(null);

const activeScrollEl = computed(() => {
  return isMobile.value ? mobileScrollEl.value : desktopScrollEl.value;
});

const showTopFade = ref(false);
const showBottomFade = ref(false);

function updateFadeState(el: HTMLElement | null) {
  if (!el) {
    showTopFade.value = false;
    showBottomFade.value = false;
    return;
  }
  showTopFade.value = el.scrollTop > 1;
  showBottomFade.value = el.scrollHeight - el.scrollTop - el.clientHeight > 1;
}

let scrollTicking = false;

function handleScroll() {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      updateFadeState(activeScrollEl.value);
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}

const fadeMask = computed(() => {
  const top = showTopFade.value;
  const bottom = showBottomFade.value;

  if (top && bottom) {
    return 'linear-gradient(to bottom, transparent 0px, black 32px, black calc(100% - 32px), transparent 100%)';
  } else if (top) {
    return 'linear-gradient(to bottom, transparent 0px, black 32px)';
  } else if (bottom) {
    return 'linear-gradient(to top, transparent 0px, black 32px)';
  }
  return 'none';
});

let resizeObserver: ResizeObserver | null = null;

function setupObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const el = activeScrollEl.value;
  if (!el) {
    showTopFade.value = false;
    showBottomFade.value = false;
    return;
  }

  updateFadeState(el);

  resizeObserver = new ResizeObserver(() => {
    updateFadeState(activeScrollEl.value);
  });
  resizeObserver.observe(el);

  for (const child of el.children) {
    resizeObserver.observe(child);
  }
}

watch(activeScrollEl, () => {
  setupObserver();
});

watch(activeViewId, () => {
  void nextTick(() => {
    setupObserver();
  });
});

onMounted(() => {
  setupObserver();
});

defineExpose({ menuEl: desktopMenuEl, startClose });
</script>

<template>
  <BaseMenuCard
    ref="desktopMenuCardRef"
    :open="open && !isMobile"
    :desktop-transition="desktopTransition"
    v-bind="$attrs"
    role="menu"
    aria-orientation="vertical"
    tabindex="-1"
    @after-leave="emit('after-leave')"
  >
    <div
      ref="desktopScrollEl"
      class="flex-1 overflow-y-auto overflow-x-hidden p-1 max-h-[min(70vh,400px)] gap-0 flex flex-col items-stretch list-fade"
      :style="{ '--menu-fade-mask': fadeMask }"
      @scroll="handleScroll"
    >
      <slot></slot>
    </div>
  </BaseMenuCard>

  <BaseSheet
    v-if="isMobile"
    ref="sheetComponentRef"
    :open="open"
    :elevated="elevated"
    role="menu"
    :aria-label="title"
    aria-orientation="vertical"
    tabindex="-1"
    @cancel="startClose"
    @after-leave="emit('after-leave')"
  >
    <!-- Pulled up over the sheet scroller's top padding, so content scrolls
         up under the drag handle like in BaseModal's sheet. The sticky header
         then sits below the handle, thanks to the matching pt-6. -->
    <div
      ref="mobileScrollEl"
      class="-mt-6 pt-6 overflow-y-auto overflow-x-hidden max-h-[70vh]"
      @scroll="handleScroll"
    >
      <!-- Fade reaches up under the handle to the scrollers' edges; the sheet
           scroller's clip rounds its corners. Below the header it only covers
           the views' empty p-1 padding, so nothing is blurred until the
           content is scrolled. Only rendered once scrolled, sparing the
           backdrop filters when there is nothing underneath. -->
      <div class="sticky top-0 z-10">
        <BaseScrollFade
          v-show="showTopFade"
          color="var(--color-surface)"
          class="inset-x-0 -top-6 -bottom-1"
        />

        <!-- Styled like the email heading of AccountMenu's sheet. -->
        <div
          v-if="title"
          class="px-4 pb-2 text-center font-semibold text-base text-on-ghost truncate"
        >
          {{ sheetTitle }}
        </div>

        <div
          class="transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden"
          :class="
            !isAtRoot
              ? 'max-h-11 opacity-100 pointer-events-auto mt-1'
              : 'max-h-0 opacity-0 pointer-events-none mt-0'
          "
        >
          <BaseButton
            variant="ghost"
            on="ghost"
            :icon="ChevronLeft"
            class="ml-1 w-fit"
            @click="popView"
            >{{ t('common.buttons.back') }}</BaseButton
          >
        </div>
      </div>

      <div
        class="relative overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[height]"
        :style="{ height: menuHeight === 'auto' ? 'auto' : `${menuHeight}px` }"
      >
        <div
          ref="rootViewEl"
          class="w-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          :class="
            activeViewId === 'root'
              ? 'relative translate-x-0 opacity-100 pointer-events-auto'
              : 'absolute top-0 left-0 -translate-x-8 opacity-0 pointer-events-none'
          "
        >
          <div class="p-1">
            <slot></slot>
          </div>
        </div>

        <div
          ref="subViewEl"
          class="w-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          :class="
            activeViewId !== 'root'
              ? 'relative translate-x-0 opacity-100 pointer-events-auto'
              : 'absolute top-0 left-0 translate-x-8 opacity-0 pointer-events-none'
          "
        >
          <div ref="submenuTarget" class="p-1"></div>
        </div>
      </div>
    </div>
  </BaseSheet>
</template>

<style>
.list-fade {
  -webkit-mask-image: var(--menu-fade-mask, none);
  mask-image: var(--menu-fade-mask, none);
}
</style>
