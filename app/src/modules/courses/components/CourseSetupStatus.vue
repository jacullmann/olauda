<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useElementSize } from '@vueuse/core';

const props = defineProps<{
  openSubjectNames: string[];
}>();

const ROW_CLASSES =
  'flex items-center gap-2 pl-2.5 pr-3 py-2 text-sm/4.5 font-medium';

const { t, locale } = useI18n();

const isSettled = computed(() => props.openSubjectNames.length === 0);

const subjects = computed(() =>
  new Intl.ListFormat(locale.value).format(props.openSubjectNames),
);

const message = computed(() =>
  isSettled.value
    ? t('auth.courses.all_settled')
    : t('auth.courses.open_subjects', { subjects: subjects.value }),
);

// Width cannot transition to or from `auto`, so a hidden copy of the row
// reports the width the pill should ease to.
const sizer = useTemplateRef('sizer');
const { width: contentWidth } = useElementSize(
  sizer,
  { width: 0, height: 0 },
  { box: 'border-box' },
);

// Text is cut with an ellipsis only once the pill has reached its widest
// possible width; while it is still growing, it is clipped and revealed.
const pill = useTemplateRef('pill');
const { width: availableWidth } = useElementSize(
  () => pill.value?.parentElement,
);
const isTruncated = computed(
  () => availableWidth.value > 0 && contentWidth.value > availableWidth.value,
);
</script>

<template>
  <div
    ref="pill"
    role="status"
    :data-truncated="isTruncated"
    class="status-pill group sticky z-10 self-center max-w-full rounded-full top-4 max-md:top-(--simple-header-height)"
    :class="
      isSettled ? 'bg-success text-on-success' : 'bg-action text-on-action'
    "
    :style="{ width: contentWidth ? `${contentWidth}px` : undefined }"
  >
    <div :class="[ROW_CLASSES, 'overflow-clip rounded-full']">
      <svg
        class="status-icon size-4.5 shrink-0"
        :data-settled="isSettled"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle
          class="status-icon__ring"
          cx="12"
          cy="12"
          r="10"
          pathLength="100"
        />
        <path class="status-icon__check" d="m9 12 2 2 4-4" pathLength="1" />
      </svg>

      <!-- Old and new messages share one cell so a swap crossfades in place.
           While subjects are open only they animate, not the label. -->
      <span class="grid min-w-0 grid-cols-[minmax(0,1fr)]">
        <Transition name="status-text">
          <i18n-t
            v-if="!isSettled"
            keypath="auth.courses.open_subjects"
            tag="span"
            class="col-start-1 row-start-1 flex min-w-0 whitespace-pre"
          >
            <template #subjects>
              <Transition name="status-text" mode="out-in">
                <span
                  :key="subjects"
                  class="min-w-0 overflow-hidden whitespace-nowrap group-data-[truncated=true]:text-ellipsis"
                >
                  {{ subjects }}
                </span>
              </Transition>
            </template>
          </i18n-t>
          <span
            v-else
            class="col-start-1 row-start-1 overflow-hidden whitespace-nowrap group-data-[truncated=true]:text-ellipsis"
          >
            {{ message }}
          </span>
        </Transition>
      </span>
    </div>

    <!-- Fixed, so its natural width never adds to the page's scrollable area. -->
    <div
      ref="sizer"
      aria-hidden="true"
      :class="[
        ROW_CLASSES,
        'invisible fixed top-0 left-0 w-max whitespace-nowrap pointer-events-none',
      ]"
    >
      <span class="size-4.5 shrink-0"></span>
      <span>{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-pill {
  transition:
    width 500ms var(--ease-settle),
    color 400ms var(--ease-settle);
}

/* The dashes of the open ring grow until their gaps close, then the check is
   drawn into it. Ring and check are 100 and 1 long, set by their pathLength. */
.status-icon__ring {
  stroke-dasharray: 6 8;
  transition: stroke-dasharray 500ms var(--ease-settle);
}

.status-icon__check {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  transition:
    stroke-dashoffset 150ms cubic-bezier(0.5, 0, 1, 1),
    opacity 100ms linear 50ms;
}

.status-icon[data-settled='true'] .status-icon__ring {
  stroke-dasharray: 12.5 0;
}

.status-icon[data-settled='true'] .status-icon__check {
  stroke-dashoffset: 0;
  opacity: 1;
  transition:
    stroke-dashoffset 400ms var(--ease-settle) 200ms,
    opacity 100ms linear 200ms;
}

/* The text trails the pill's width on the way in and leads it on the way out. */
.status-text-enter-active {
  transition:
    opacity 250ms linear 60ms,
    transform 400ms var(--ease-settle) 60ms,
    filter 300ms cubic-bezier(0.25, 0.5, 0.75, 1) 60ms;
}

.status-text-leave-active {
  transition:
    opacity 150ms linear,
    transform 200ms cubic-bezier(0.5, 0, 1, 1),
    filter 150ms cubic-bezier(0.25, 0, 0.3, 1);
}

.status-text-enter-from {
  opacity: 0;
  transform: translateY(0.4rem);
  filter: blur(3px);
}

.status-text-leave-to {
  opacity: 0;
  transform: translateY(-0.4rem);
  filter: blur(3px);
}
</style>
