<script setup lang="ts">
import { ref, nextTick, computed, useAttrs } from 'vue';
import { onClickOutside, useElementBounding } from '@vueuse/core';
import { ChevronDown } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { labelTextFor } from '@/common/utils/labelText';

const { t } = useI18n();

export interface UnitOption {
  label: string;
  value: string;
  hint?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    options: UnitOption[];
    disabled?: boolean;
    form?: boolean;
    classes?: string;
    /** Mobile sheet title; defaults to the text of the select's label. */
    title?: string;
  }>(),
  {
    disabled: false,
    form: true,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isOpen = ref(false);
const wrapperRef = ref<any>(null);
const floatingRef = ref<any>(null);

const triggerEl = computed(() => wrapperRef.value?.$el || null);
const menuEl = computed(() => floatingRef.value?.menuEl || null);

const { floatingStyles, isPositioned } = useFloating(triggerEl, menuEl, {
  placement: 'bottom-start',
  whileElementsMounted: autoUpdate,
  transform: false,
  middleware: [offset(4), flip(), shift({ padding: 8 })],
});

const { width } = useElementBounding(triggerEl);

const selectStyles = computed(() => ({
  ...floatingStyles.value,
  width: `${width.value}px`,
  zIndex: 100002,
  opacity: isPositioned.value ? undefined : 0,
}));

const attrs = useAttrs();
const sheetTitle = ref<string>();

const toggleMenu = async () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;

    if (isOpen.value) {
      sheetTitle.value = props.title ?? labelTextFor(attrs.id);
      await nextTick();

      if (floatingRef.value) {
        const innerMenuEl = floatingRef.value.menuEl as HTMLElement;

        const selectedElement = innerMenuEl?.querySelector(
          '[aria-checked="true"]',
        );

        if (selectedElement) {
          requestAnimationFrame(() => {
            selectedElement.scrollIntoView({
              block: 'nearest',
              behavior: 'auto',
            });
          });
        }
      }
    }
  }
};

const selectedOption = computed(() =>
  props.options.find((o) => o.value === props.modelValue),
);

const selectOption = (value: string) => {
  emit('update:modelValue', value);
  isOpen.value = false;
};

onClickOutside(
  wrapperRef,
  () => {
    isOpen.value = false;
  },
  { ignore: [menuEl] },
);
</script>

<template>
  <div class="relative">
    <BaseButton
      ref="wrapperRef"
      :disabled="disabled"
      class="outline-none"
      :class="[
        form
          ? 'transition-focus ' +
            (isOpen ? 'border-focus! shadow-focus-ring!' : '')
          : isOpen
            ? 'bg-ghost-hover! text-on-ghost!'
            : '',
        classes,
      ]"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :variant="form ? 'input' : 'ghost'"
      :icon="ChevronDown"
      icon-placement="trailing"
      :icon-classes="
        'text-on-ghost-muted ml-auto shrink-0 transition duration-200 ease-in-out' +
        (isOpen ? ' rotate-180' : '')
      "
      @click="toggleMenu"
    >
      <slot
        v-if="selectedOption && $slots.icon"
        name="icon"
        :option="selectedOption"
        :size="20"
      />
      <span class="truncate">
        {{ selectedOption?.label || t('common.selection.placeholder') }}
        <span v-if="selectedOption?.hint" class="text-on-ghost-muted">{{
          selectedOption.hint
        }}</span>
      </span>
    </BaseButton>

    <Teleport to="body">
      <BaseMenu
        ref="floatingRef"
        :open="isOpen"
        :title="sheetTitle"
        :style="selectStyles"
        class="max-h-80 z-[9999]"
        @close="isOpen = false"
      >
        <BaseMenuButton
          v-for="option in options"
          :key="option.value"
          type="button"
          is-select
          :active="modelValue === option.value"
          :disabled="option.disabled"
          @click="selectOption(option.value)"
        >
          <template v-if="$slots.icon" #icon="{ size }">
            <slot name="icon" :option="option" :size="size" />
          </template>
          {{ option.label }}
          <span v-if="option.hint" class="text-on-ghost-muted">{{
            option.hint
          }}</span>
        </BaseMenuButton>
      </BaseMenu>
    </Teleport>
  </div>
</template>
