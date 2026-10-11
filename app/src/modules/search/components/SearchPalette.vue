<script setup lang="ts">
import { computed, useId, useTemplateRef, type InputHTMLAttributes } from 'vue';
import { onKeyStroke } from '@vueuse/core';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import { useSearchPalette } from '@/modules/search/composables/useSearchPalette';
import { optionElementId } from '@/modules/search/utils/sections';
import SearchDialog from './SearchDialog.vue';
import SearchHeaderOverlay from './SearchHeaderOverlay.vue';
import SearchResults from './SearchResults.vue';

const emit = defineEmits<{ cancel: [] }>();

const isMobile = useIsMobileViewport();
const listboxId = useId();
const shell = useTemplateRef<{ focus: () => void }>('shell');

const {
  query,
  view,
  isNested,
  sections,
  activeItem,
  setActive,
  select,
  back,
  handleKeydown,
} = useSearchPalette(() => emit('cancel'));

// Phones show no highlight: it and the hints that come with it are for arrow
// keys. Enter on the on-screen keyboard still picks the top result.
const highlightedItem = computed(() =>
  isMobile.value ? undefined : activeItem.value,
);

const inputAttrs = computed<InputHTMLAttributes>(() => ({
  role: 'combobox',
  'aria-expanded': true,
  'aria-controls': listboxId,
  'aria-autocomplete': 'list',
  'aria-activedescendant': highlightedItem.value
    ? optionElementId(listboxId, highlightedItem.value)
    : undefined,
  onKeydown: handleKeydown,
}));

// The back button unmounts with the view it leaves, taking focus with it.
function backToFullList() {
  back();
  shell.value?.focus();
}

onKeyStroke('Escape', () => emit('cancel'));
</script>

<template>
  <component
    :is="isMobile ? SearchHeaderOverlay : SearchDialog"
    ref="shell"
    v-model="query"
    :label="view.title"
    :placeholder="view.placeholder"
    :input-attrs="inputAttrs"
    @cancel="emit('cancel')"
  >
    <SearchResults
      :id="listboxId"
      :title="view.title"
      :nested="isNested"
      :query="query"
      :sections="sections"
      :active-item="highlightedItem"
      :touch="isMobile"
      @select="select"
      @activate="setActive"
      @back="backToFullList"
    />
  </component>
</template>
