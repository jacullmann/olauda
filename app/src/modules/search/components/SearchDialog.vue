<script setup lang="ts">
import { onMounted, useTemplateRef, type InputHTMLAttributes } from 'vue';
import { Search } from '@lucide/vue';
import { useBottomFadeMask } from '@/modules/search/composables/useBottomFadeMask';

/** The search on wider screens: a dialog centred over the shaded page. */
defineProps<{
  label: string;
  placeholder: string;
  /** Wires the input up as the combobox controlling the results. */
  inputAttrs: InputHTMLAttributes;
}>();

defineEmits<{ cancel: [] }>();

const query = defineModel<string>({ required: true });

const input = useTemplateRef('input');
const { fadeMask } = useBottomFadeMask(useTemplateRef('scroller'));

function focus() {
  input.value?.focus({ preventScroll: true });
}

onMounted(focus);

defineExpose({ focus });
</script>

<template>
  <BaseBackdrop class="z-(--z-modal-overlay)" @cancel="$emit('cancel')">
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      class="bg-surface border border-ghost-border rounded-2xl w-[calc(100%-32px)] max-w-140 overflow-hidden fixed text-left z-100001"
    >
      <div class="flex items-center gap-3 p-4 border-b border-ghost-border">
        <Search :size="20" class="text-on-ghost-subtle shrink-0" />
        <input
          ref="input"
          v-model="query"
          v-bind="inputAttrs"
          type="text"
          :aria-label="label"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          class="flex-1 w-full p-0 rounded-none bg-transparent border-none outline-none shadow-none text-on-ghost text-base/4 placeholder:text-on-ghost-subtle"
        />
      </div>

      <div
        ref="scroller"
        class="max-h-105 overflow-y-auto"
        :style="{ maskImage: fadeMask }"
      >
        <slot></slot>
      </div>
    </div>
  </BaseBackdrop>
</template>
