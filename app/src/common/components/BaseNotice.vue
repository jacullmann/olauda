<script setup lang="ts">
import type { Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { X } from '@lucide/vue';

withDefaults(
  defineProps<{
    show: boolean;
    icon: Component;
    /** Off for a page shown again, which should not replay its entrance. */
    entrance?: boolean;
    /** Off for a notice that must stay as long as its condition holds. */
    dismissible?: boolean;
  }>(),
  { entrance: true, dismissible: true },
);

const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();
</script>

<template>
  <Transition name="notice-reveal">
    <div v-if="show" class="notice-reveal">
      <div class="min-h-0">
        <div
          class="flex items-center gap-2 text-sm text-on-ghost-muted"
          :class="{ 'animate-enter': entrance }"
        >
          <component
            :is="icon"
            :size="16"
            class="shrink-0"
            aria-hidden="true"
          />
          <span class="m-0 flex flex-1 flex-wrap items-center gap-x-1.5">
            <slot />
          </span>
          <button
            v-if="dismissible"
            type="button"
            class="relative shrink-0 rounded-full cursor-pointer text-on-ghost-muted hover:text-on-ghost transition-hover outline-none focus-visible:ring-2 focus-visible:ring-focus touch-target after:min-w-12 after:min-h-12"
            :aria-label="t('common.buttons.hide_notice')"
            :title="t('common.buttons.hide_notice')"
            @click="emit('dismiss')"
          >
            <X :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/*
 * A notice often appears once the data has loaded, while the content below is
 * already entering. Its row and the margins the page gives it open from zero,
 * so that content eases down instead of being shoved by a full line. The text
 * stays unclipped so its blurred, rising entrance is not cut off.
 */
.notice-reveal {
  display: grid;
  grid-template-rows: 1fr;
}

.notice-reveal-enter-active,
.notice-reveal-leave-active {
  transition:
    grid-template-rows 500ms var(--ease-settle),
    margin 500ms var(--ease-settle),
    opacity 150ms linear;
}

.notice-reveal-enter-from,
.notice-reveal-leave-to {
  grid-template-rows: 0fr;
  margin-block: 0;
}

.notice-reveal-leave-to {
  opacity: 0;
}
</style>
