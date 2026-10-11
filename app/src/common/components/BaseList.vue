<script setup lang="ts">
import { computed, nextTick, watch, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRight, ChevronsUpDown } from '@lucide/vue';
import { useFloatingMenu } from '@/common/composables/useFloatingMenu';
import type { UnitOption } from './BaseSelect.vue';
import { haptic } from '@/common/utils/haptics';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    separator?: boolean;
    chevron?: boolean;
    select?: boolean;
    toggle?: boolean;
    /** Only used with `select`. */
    options?: UnitOption[];
    modelValue?: string | null;
    /** Mobile sheet title of the select menu. */
    title?: string;
    /** Only used with `toggle`. */
    checked?: boolean;
  }>(),
  {
    disabled: false,
    separator: true,
    chevron: true,
    select: false,
    toggle: false,
    options: () => [],
    modelValue: null,
    checked: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:checked', value: boolean): void;
}>();

const {
  isOpen,
  triggerRef,
  menuComponentRef,
  menuStyles,
  toggle: toggleMenu,
  close,
} = useFloatingMenu({ placement: 'bottom-end', offset: 4 });

// Same layer as BaseSelect's menu, so it also opens above modals.
const selectMenuStyles = computed<CSSProperties>(() => ({
  ...menuStyles.value,
  zIndex: 100002,
}));

const selectedOption = computed(() =>
  props.options.find(({ value }) => value === props.modelValue),
);

watch(isOpen, async (open) => {
  if (!open) return;
  await nextTick();
  const selected = menuComponentRef.value?.menuEl?.querySelector(
    '[aria-checked="true"]',
  );
  if (selected) {
    requestAnimationFrame(() => selected.scrollIntoView({ block: 'nearest' }));
  }
});

// BaseMenu closes on any outside pointerdown, after which the click would
// toggle it straight back open; the trigger's own click does the closing.
function keepMenuForToggle(event: PointerEvent) {
  if (props.select && isOpen.value) event.stopPropagation();
}

function handleClick() {
  if (props.select) toggleMenu();
  else if (props.toggle) {
    emit('update:checked', !props.checked);
    haptic();
  }
}

function selectOption(value: string) {
  emit('update:modelValue', value);
  close();
}
</script>

<template>
  <button
    ref="triggerRef"
    v-wave
    v-bind="$attrs"
    class="relative group flex items-center w-full gap-2 py-3 px-6 md:p-3.5 md:pr-6 md:rounded-2xl bg-transparent cursor-pointer text-left transition-hover hover:bg-ghost-hover active:bg-ghost-hover disabled:opacity-50"
    :class="[
      $slots.icon ? '' : 'md:pl-6',
      { 'bg-ghost-hover': select && isOpen },
    ]"
    :disabled="disabled"
    :role="toggle ? 'switch' : undefined"
    :aria-checked="toggle ? checked : undefined"
    :aria-haspopup="select ? 'menu' : undefined"
    :aria-expanded="select ? isOpen : undefined"
    @pointerdown="keepMenuForToggle"
    @click="handleClick"
  >
    <span
      v-if="$slots.icon"
      class="flex items-center justify-center"
      :class="$slots.desc ? 'size-10' : 'w-9 h-5'"
    >
      <slot name="icon"></slot>
    </span>

    <span class="flex flex-col flex-1 gap-1 min-w-0">
      <span
        class="text-on-ghost text-base/5 truncate"
        :class="$slots.desc ? 'font-semibold' : 'font-normal'"
      >
        <slot name="label"></slot>
      </span>
      <span
        v-if="$slots.desc"
        class="text-on-ghost-muted text-sm/4 font-normal"
      >
        <slot name="desc"></slot>
      </span>
    </span>

    <span
      v-if="select"
      class="flex items-center gap-1 shrink-0 text-on-ghost-muted"
    >
      <span>{{
        selectedOption?.label ?? t('common.selection.placeholder')
      }}</span>
      <ChevronsUpDown :size="20" />
    </span>

    <BaseToggle v-else-if="toggle" :model-value="checked" decorative />

    <ChevronRight v-else-if="chevron" :size="20" class="text-on-ghost-muted" />
  </button>

  <div
    v-if="separator"
    v-bind="$attrs"
    class="separator mr-6"
    :class="
      $slots.icon
        ? $slots.desc
          ? 'ml-18 md:ml-15.5'
          : 'ml-17 md:ml-14.5'
        : 'ml-6'
    "
  ></div>

  <Teleport v-if="select" to="body">
    <BaseMenu
      ref="menuComponentRef"
      :open="isOpen"
      :title="title"
      :style="selectMenuStyles"
      @close="close"
    >
      <BaseMenuButton
        v-for="option in options"
        :key="option.value"
        is-select
        :active="option.value === modelValue"
        :disabled="option.disabled"
        @click="selectOption(option.value)"
      >
        {{ option.label }}
        <span v-if="option.hint" class="text-on-ghost-muted">{{
          option.hint
        }}</span>
      </BaseMenuButton>
    </BaseMenu>
  </Teleport>
</template>
