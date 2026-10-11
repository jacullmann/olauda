<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import { Check, X } from '@lucide/vue';
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { expandFrom, type MorphOrigin } from '@/common/utils/morph';

// Two roots (dialog and sheet), so attributes and listeners such as drag and
// drop handlers are forwarded to whichever one is shown.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  cancel: [];
  success: [];
}>();

const props = withDefaults(
  defineProps<{
    open: boolean;
    submit?: () => void;
    cancel?: () => void;
    danger?: boolean;
    error?: string;
    loading?: boolean;
    requirement?: boolean;
    sheet?: boolean;
    /**
     * Opens the modal, in both its shapes, above a fullscreen overlay that
     * already sits above the normal layers, such as the image viewer. See
     * BaseSheet's own `elevated`.
     */
    elevated?: boolean;
    /** The sheet is dismissed by dragging it down, so it never has one. */
    closeButton?: boolean;
    /**
     * On mobile, moves the form's cancel and submit into the title row, in
     * place of the close button and the buttons below the form. Like `sheet`,
     * it changes nothing on desktop.
     */
    headerActions?: boolean;
    /** See BaseModalCard's own `wide`; a sheet always spans the screen. */
    wide?: boolean;
    /** Grows the modal, in both its shapes, out of this on open. */
    origin?: MorphOrigin | null;
  }>(),
  {
    danger: false,
    error: '',
    loading: false,
    requirement: true,
    sheet: false,
    elevated: false,
    closeButton: true,
    headerActions: false,
    wide: false,
    origin: null,
  },
);

const handleCancel = () => {
  if (props.cancel) {
    props.cancel();
  } else {
    emit('cancel');
  }
};

const { t } = useI18n();
const isMobile = useIsMobileViewport();
const titleId = useId();
const formId = useId();

const showHeaderActions = computed(
  () => props.headerActions && isMobile.value && !!props.submit,
);
const showCornerCloseButton = computed(
  () => props.closeButton && !showHeaderActions.value,
);

const titleRowClasses = computed(() => {
  if (showHeaderActions.value) return 'flex-nowrap! h-7.5 mb-4';
  if (!props.closeButton) return 'items-start h-7.5 mx-4 mb-2 mt-1';
  // pr-12 reserves the corner close button's width plus gap
  return 'items-start h-7.5 pr-12 mb-4';
});

// Fades in without fade-scale's scale and blur, which the dialog's own
// growth replaces. It closes with fade-scale like any other.
const dialogTransition = computed(() => ({
  name: 'fade-scale',
  ...(props.origin && {
    enterFromClass: 'opacity-0',
    enterActiveClass: 'transition-opacity duration-250 ease-out',
    onEnter: (root: Element) => {
      const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
      if (dialog && props.origin) expandFrom(dialog, props.origin);
    },
  }),
}));

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') handleCancel();
});
</script>

<template>
  <Teleport to="body">
    <Transition v-bind="dialogTransition" appear>
      <BaseModalCard
        v-if="open && (!isMobile || !sheet)"
        v-bind="$attrs"
        :labelledby="titleId"
        :elevated="elevated"
        :round="!showCornerCloseButton"
        :wide="wide"
        @cancel="handleCancel"
      >
        <BaseRow
          class="sticky top-0 z-10"
          :class="titleRowClasses"
          :justify="showHeaderActions ? 'between' : 'start'"
        >
          <!-- Firefox leaves backdrop filters outside the scroller's clip
               path, so the blur would square off the card's top corners.
               The fade clips itself there instead: a rounded overflow clip
               drops its masks in Chromium, and on the scroller or card it
               drops the blur in Firefox. -->
          <BaseScrollFade
            class="-top-4 -bottom-4 firefox:overflow-hidden firefox:rounded-t-(--card-radius)"
            :class="
              showHeaderActions || closeButton ? '-inset-x-4' : '-inset-x-8'
            "
          />

          <!--BaseButton
            v-if="showHeaderActions"
            type="button"
            variant="ghost"
            :icon="X"
            :aria-label="t('common.buttons.cancel')"
            @click="handleCancel"
          /-->

          <BaseRow class="min-w-0" :class="{ 'mx-auto': headerActions }">
            <h3 :id="titleId">
              <slot name="title"></slot>
            </h3>

            <slot name="title-infopop"></slot>
          </BaseRow>

          <!-- Submits through the form, so validation and the submit
               handler run exactly as for the button below it. -->
          <!--BaseButton
            v-if="showHeaderActions"
            type="submit"
            :form-id="formId"
            :variant="danger ? 'danger' : 'action'"
            :icon="Check"
            :loading="loading"
            :disabled="loading || !requirement"
            :aria-label="t('common.buttons.confirm')"
          /-->
        </BaseRow>

        <template v-if="showCornerCloseButton" #corner>
          <BaseButton
            type="button"
            variant="ghost"
            :icon="X"
            @click="handleCancel"
          />
        </template>

        <BaseForm
          v-if="submit"
          :id="formId"
          :submit="submit"
          :cancel="handleCancel"
          :error="error"
          :danger="danger"
          :loading="loading"
          :requirement="requirement"
          :margin="!showCornerCloseButton && !showHeaderActions"
        >
          <template v-for="(_, name) in $slots" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps || {}"></slot>
          </template>
        </BaseForm>

        <slot v-else name="content"></slot>
      </BaseModalCard>
    </Transition>
  </Teleport>

  <BaseSheet
    v-if="sheet && isMobile"
    v-bind="$attrs"
    :open="open"
    :elevated="elevated"
    :origin="origin"
    @cancel="handleCancel"
  >
    <div class="px-4 pb-4">
      <!-- Sticks below the drag handle. The fade reaches up under the handle
           to the scroller's edges, like the modal's fade covers its padding;
           the scroller's clip rounds its corners. -->
      <BaseRow class="sticky top-0 z-10 mb-4">
        <BaseScrollFade
          color="var(--color-surface)"
          class="-inset-x-4 -top-6 -bottom-4"
        />

        <h3 :id="titleId">
          <slot name="title"></slot>
        </h3>
      </BaseRow>

      <BaseForm
        v-if="submit"
        :submit="submit"
        :cancel="handleCancel"
        :error="error"
        :danger="danger"
        :loading="loading"
        :requirement="requirement"
      >
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps || {}"></slot>
        </template>
      </BaseForm>

      <slot v-else name="content"></slot>
    </div>
  </BaseSheet>
</template>
