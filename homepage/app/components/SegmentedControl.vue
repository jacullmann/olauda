<script setup lang="ts" generic="T extends string | number">
export interface SegmentedOption<V> {
  value: V;
  label: string;
  /** Accessible name when the visible label is abbreviated. */
  ariaLabel?: string;
  marked?: boolean;
}

const props = defineProps<{
  options: readonly SegmentedOption<T>[];
  label: string;
}>();

const model = defineModel<T>({ required: true });

const container = useTemplateRef<HTMLElement>('container');
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons');
const pill = ref<{ left: number; width: number } | null>(null);

const activeIndex = computed(() =>
  props.options.findIndex((option) => option.value === model.value),
);

const measure = () => {
  const button = buttons.value?.[activeIndex.value];
  pill.value = button ? { left: button.offsetLeft, width: button.offsetWidth } : null;
};

watch(activeIndex, () => nextTick(measure));
useResizeObserver(container, measure);

const select = (index: number) => {
  const option = props.options[index];
  if (!option) return;
  model.value = option.value;
  buttons.value?.[index]?.focus();
};

const onKeydown = (event: KeyboardEvent) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (step === undefined) return;
  event.preventDefault();
  const count = props.options.length;
  select((activeIndex.value + step + count) % count);
};
</script>

<template>
  <div
    ref="container"
    role="radiogroup"
    :aria-label="label"
    class="relative isolate flex w-fit rounded-full border border-ghost-border bg-surface p-0.5 shadow-input"
    @keydown="onKeydown"
  >
    <span
      v-if="pill"
      aria-hidden="true"
      class="absolute inset-y-0.5 left-0 -z-10 rounded-full bg-action transition-[translate,width] duration-500 ease-spring"
      :style="{ translate: `${pill.left}px 0`, width: `${pill.width}px` }"
    />
    <button
      v-for="(option, index) in options"
      ref="buttons"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="index === activeIndex"
      :aria-label="option.ariaLabel"
      :tabindex="index === activeIndex ? 0 : -1"
      class="relative flex h-9 min-w-10 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm/4 font-medium transition-colors duration-200"
      :class="[
        index === activeIndex ? 'text-on-action' : 'text-on-ghost-muted hover:text-on-ghost',
        index === activeIndex && !pill && 'bg-action',
      ]"
      @click="select(index)"
    >
      {{ option.label }}
      <span
        v-if="option.marked"
        aria-hidden="true"
        class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent"
      />
    </button>
  </div>
</template>
