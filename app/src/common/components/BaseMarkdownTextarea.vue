<script setup lang="ts">
import { ref, computed } from 'vue';
import { BULLET_MARKER } from '@/common/utils/bullets';

const props = withDefaults(
  defineProps<{
    id: string;
    required?: boolean;
    rows?: string | number;
    maxRows?: string | number;
  }>(),
  {
    required: false,
    rows: '4',
    maxRows: undefined,
  },
);

defineOptions({
  inheritAttrs: false,
});

const model = defineModel<string>();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const backdropRef = ref<HTMLDivElement | null>(null);

// Splitting on the captured marker puts the bullets at the odd indices.
const segments = computed(() => {
  const text = model.value || '';
  // A trailing newline collapses in the backdrop without a character after it
  return (text.endsWith('\n') ? `${text}\u200B` : text).split(BULLET_MARKER);
});

const handleScroll = (e: Event) => {
  const textarea = e.target as HTMLTextAreaElement;
  if (backdropRef.value) {
    backdropRef.value.scrollTop = textarea.scrollTop;
    backdropRef.value.scrollLeft = textarea.scrollLeft;
  }
};

defineExpose({
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
  select: () => textareaRef.value?.select(),
});
</script>

<template>
  <div
    class="relative w-full rounded-lg bg-surface border border-ghost-border shadow-input transition-focus focus-within:border-focus focus-within:shadow-focus-ring"
  >
    <!-- Backdrop rendering the text with bullets (placed behind the transparent textarea) -->
    <div
      ref="backdropRef"
      class="backdrop-div absolute inset-0 text-on-ghost pointer-events-none overflow-y-auto whitespace-pre-wrap break-words select-none scrollbar-hide"
    >
      <template v-for="(segment, index) in segments" :key="index">
        <span v-if="index % 2" class="bullet-marker">{{ segment }}</span>
        <template v-else>{{ segment }}</template>
      </template>
    </div>

    <!-- Textarea input overlay (placed in front of the backdrop) -->
    <textarea
      :id="props.id"
      ref="textareaRef"
      v-model="model"
      class="custom-textarea resize-vertical block! w-full bg-transparent outline-none shadow-none"
      :class="{ 'auto-grow': props.maxRows }"
      :style="props.maxRows ? { '--max-rows': props.maxRows } : undefined"
      :rows="props.rows"
      :aria-required="props.required"
      v-bind="$attrs"
      @scroll="handleScroll"
    ></textarea>
  </div>
</template>

<style scoped>
/* Strict structural resets to guarantee 100% identical dimensions, spacing and text rendering */
.custom-textarea,
.backdrop-div {
  margin: 0 !important;
  border: 0 !important;
  padding: 8px 12px !important; /* py-2 px-3 matches BaseInput.vue spacing exactly */
  font-family: var(--font-sans), sans-serif !important;
  font-size: 1rem !important;
  line-height: 1.25rem !important;
  letter-spacing: normal !important;
  word-spacing: normal !important;
  text-transform: none !important;
  text-indent: 0px !important;
  box-sizing: border-box !important;
  white-space: pre-wrap !important;
  overflow-wrap: break-word !important;
  word-break: break-word !important;
  font-variant-ligatures: none !important;
  font-feature-settings:
    'liga' 0,
    'clig' 0,
    'dlig' 0,
    'hlig' 0,
    'calt' 0 !important;
  font-kerning: none !important;
}

.backdrop-div {
  position: absolute !important;
  z-index: 1 !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
}

.custom-textarea {
  position: relative !important;
  z-index: 2 !important;
  color: transparent;
  caret-color: var(--color-on-ghost) !important;
}

/* Browsers without field-sizing keep the fixed `rows` height */
@supports (field-sizing: content) {
  .custom-textarea.auto-grow {
    field-sizing: content;
    min-height: calc(1lh + 16px);
    max-height: calc(var(--max-rows) * 1lh + 16px);
    resize: none;
  }
}

.custom-textarea::placeholder {
  color: var(--color-on-ghost-subtle) !important;
  opacity: 1 !important;
}

/* Selected text in the textarea becomes visible with standard theme selection colors, overlaying the backdrop */
.custom-textarea::selection {
  background-color: var(--color-action) !important;
  color: var(--color-on-action) !important;
}

.custom-textarea::-moz-selection {
  background-color: var(--color-action) !important;
  color: var(--color-on-action) !important;
}

/* The marker keeps its own width, so the caret stays aligned with the textarea */
.bullet-marker {
  color: transparent;
  position: relative;
}

.bullet-marker::before {
  content: '•';
  position: absolute;
  inset-inline: 0;
  text-align: center;
  color: var(--color-on-ghost);
  font-weight: bold;
}
</style>
