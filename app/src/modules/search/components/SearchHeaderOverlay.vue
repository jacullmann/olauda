<script setup lang="ts">
import { onMounted, useTemplateRef, type InputHTMLAttributes } from 'vue';
import { useI18n } from 'vue-i18n';
import { useScroll, useWindowSize } from '@vueuse/core';
import { Search, X } from '@lucide/vue';

/**
 * The search on phones. It grows out of AppHeader's search button: the bar
 * slides out to the left carrying the button's icon, and the results fade in
 * over the frosted page. AppModalHost runs its enter and leave as the
 * `header-search` transition.
 */
defineProps<{
  label: string;
  placeholder: string;
  /** Wires the input up as the combobox controlling the results. */
  inputAttrs: InputHTMLAttributes;
}>();

defineEmits<{ cancel: [] }>();

const query = defineModel<string>({ required: true });

const { t } = useI18n();
const input = useTemplateRef('input');
const results = useTemplateRef('results');

// The on-screen keyboard only shrinks the visual viewport; sized to the
// layout viewport, the last results would stay out of reach behind it.
const { height: visibleHeight } = useWindowSize({ type: 'visual' });

const { y: resultsScrollY } = useScroll(results);

function focus() {
  input.value?.focus({ preventScroll: true });
}

// Focused synchronously: iOS only raises the keyboard for a focus it can tie
// to the tap that opened the search.
onMounted(focus);

defineExpose({ focus });
</script>

<template>
  <div role="dialog" aria-modal="true" :aria-label="label">
    <BaseBackdrop
      tint="frost"
      opacity="heavy"
      blur-size="lg"
      class="search-backdrop touch-none"
      @cancel="$emit('cancel')"
    />

    <!-- Reaches up under the bar, so results scroll beneath its fade. -->
    <div
      ref="results"
      class="search-results fixed inset-x-0 top-0 z-(--z-modal) pt-[calc(var(--header-height)+0.5rem)] pb-[env(safe-area-inset-bottom,0px)] overflow-y-auto overscroll-contain"
      :style="{ maxHeight: `${visibleHeight}px` }"
    >
      <slot></slot>
    </div>

    <!-- Laid out like AppHeader's row, so the bar ends where the search
         button sits and the cancel button takes the account button's place. -->
    <div
      class="fixed top-0 inset-x-0 z-(--z-modal) h-(--header-height) flex justify-center pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      <BaseScrollFade
        v-show="resultsScrollY > 0"
        class="search-scroll-fade inset-0 -bottom-4"
      />
      <div class="h-full w-full max-w-325 px-4 flex items-center gap-2">
        <div class="relative flex-1 min-w-0 h-10 rounded-full overflow-hidden">
          <label
            class="search-bar absolute inset-0 isolate flex items-center rounded-full cursor-text"
          >
            <span
              aria-hidden="true"
              class="search-fill absolute inset-0 -z-10 rounded-full bg-ghost-hover"
            ></span>
            <span class="shrink-0 w-10 flex justify-center text-on-ghost-muted">
              <Search :size="20" />
            </span>
            <input
              ref="input"
              v-model="query"
              v-bind="inputAttrs"
              type="text"
              :aria-label="label"
              enterkeyhint="go"
              :placeholder="placeholder"
              autocomplete="off"
              spellcheck="false"
              class="search-input flex-1 min-w-0 h-full p-0 pr-4 rounded-none bg-transparent border-none outline-none shadow-none text-on-ghost text-base/4 placeholder:text-on-ghost-subtle"
            />
          </label>
        </div>

        <BaseButton
          class="search-cancel shrink-0"
          :icon="X"
          :aria-label="t('common.buttons.cancel')"
          @click="$emit('cancel')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Leaving, the page underneath is already live again. */
.header-search-leave-active {
  pointer-events: none;
}

.header-search-enter-active .search-bar {
  transition: transform 500ms var(--ease-settle);
}
.header-search-leave-active .search-bar {
  transition: transform 300ms var(--ease-settle);
}
/* Pushed out to the right until only its last 2.5rem show: a circle over the
   header's search button, with its icon right where the button's is. */
.header-search-enter-from .search-bar,
.header-search-leave-to .search-bar {
  transform: translateX(calc(100% - 2.5rem));
}

/* The fill fades out while closing, so the circle it collapses into never
   outlives the bar and pops off over the button. */
.header-search-enter-active .search-fill {
  transition: opacity 200ms ease-out;
}
.header-search-leave-active .search-fill {
  transition: opacity 300ms cubic-bezier(0.5, 0, 1, 1);
}

.header-search-enter-active .search-input {
  transition: opacity 300ms ease-out 100ms;
}
.header-search-leave-active .search-input {
  transition: opacity 100ms linear;
}

/* The blur grows instead of fading in. Blur reads roughly logarithmically, so
   a radius that picks up speed only gradually looks like steady growth rather
   than a jump in its first frames. The tint rides along on the same curve.
   AppHeader times its group and account fades against these curves. */
.header-search-enter-active .search-backdrop {
  transition-property:
    -webkit-backdrop-filter, backdrop-filter, background-color;
  transition-duration: 500ms;
  transition-timing-function: cubic-bezier(0.45, 0, 0.2, 1);
}
.header-search-leave-active .search-backdrop {
  transition-property:
    -webkit-backdrop-filter, backdrop-filter, background-color;
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.8, 0, 0.55, 1);
}
.header-search-enter-from .search-backdrop,
.header-search-leave-to .search-backdrop {
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  background-color: transparent;
}

/* Quick and a little late, so the results land on blur that is already there. */
.header-search-enter-active .search-results,
.header-search-enter-active .search-scroll-fade {
  transition: opacity 200ms ease-out 100ms;
}
.header-search-leave-active .search-results,
.header-search-leave-active .search-scroll-fade {
  transition: opacity 100ms linear;
}

.header-search-enter-from .search-fill,
.header-search-leave-to .search-fill,
.header-search-enter-from .search-input,
.header-search-leave-to .search-input,
.header-search-enter-from .search-results,
.header-search-leave-to .search-results,
.header-search-enter-from .search-scroll-fade,
.header-search-leave-to .search-scroll-fade {
  opacity: 0;
}

.header-search-enter-active .search-cancel {
  transition:
    opacity 200ms linear,
    scale 450ms cubic-bezier(0.34, 1.4, 0.64, 1),
    filter 300ms cubic-bezier(0.25, 0.5, 0.75, 1);
}
.header-search-leave-active .search-cancel {
  transition:
    opacity 150ms linear,
    scale 200ms cubic-bezier(0.5, 0, 1, 1),
    filter 200ms cubic-bezier(0.25, 0, 0.3, 1);
}
.header-search-enter-from .search-cancel,
.header-search-leave-to .search-cancel {
  opacity: 0;
  scale: 0.5;
  filter: blur(4px);
}
</style>
