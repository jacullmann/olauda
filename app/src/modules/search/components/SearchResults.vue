<script setup lang="ts">
import { useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronLeft, Search } from '@lucide/vue';
import { optionElementId } from '@/modules/search/utils/sections';
import type { SearchItem, SearchSection } from '@/modules/search/types';
import SearchOption from './SearchOption.vue';

const props = defineProps<{
  /** The listbox's id, which the search input points at. */
  id: string;
  title: string;
  /** Offers a way back to the full list, under the view's title. */
  nested: boolean;
  query: string;
  sections: SearchSection[];
  /** Highlighted, and scrolled to as it moves. */
  activeItem?: SearchItem;
  touch: boolean;
}>();

const emit = defineEmits<{
  select: [item: SearchItem];
  activate: [item: SearchItem];
  back: [];
}>();

const { t } = useI18n();
const sectionIdPrefix = useId();

// Only real mouse movement highlights: pointerenter also fires when the list
// scrolls under a resting cursor, and would steal the keyboard's highlight.
function activateOnMouseMove(event: PointerEvent, item: SearchItem) {
  if (event.pointerType === 'mouse' && item !== props.activeItem) {
    emit('activate', item);
  }
}

watch(
  () => props.activeItem,
  (item) => {
    if (!item) return;
    document
      .getElementById(optionElementId(props.id, item))
      ?.scrollIntoView({ block: 'nearest' });
  },
  { flush: 'post' },
);
</script>

<!-- Pressing an item must not take focus from the input: arrow keys and typing
     go on working, and on phones the keyboard stays up. -->
<template>
  <div @mousedown.prevent>
    <BaseRow v-if="nested" class="m-2">
      <BaseButton
        :icon="ChevronLeft"
        size="sm"
        :aria-label="t('common.buttons.back')"
        @click="emit('back')"
      />
      <span class="text-sm text-on-ghost-muted font-medium">{{ title }}</span>
    </BaseRow>

    <div :id="id" role="listbox" :aria-label="title">
      <div
        v-for="(section, sectionIndex) in sections"
        :key="section.title ?? sectionIndex"
        role="group"
        :aria-labelledby="
          section.title ? `${sectionIdPrefix}-${sectionIndex}` : undefined
        "
        class="not-first:mt-2"
      >
        <div
          v-if="section.title"
          :id="`${sectionIdPrefix}-${sectionIndex}`"
          role="presentation"
          class="px-4 py-1.5 text-sm text-on-ghost-muted font-medium"
        >
          {{ section.title }}
        </div>
        <SearchOption
          v-for="(item, index) in section.items"
          :id="optionElementId(id, item)"
          :key="item.id"
          :item="item"
          :active="item === activeItem"
          :touch="touch"
          :separated="index > 0"
          @click="emit('select', item)"
          @pointermove="activateOnMouseMove($event, item)"
        />
      </div>
    </div>

    <BaseEmptyState v-if="!sections.length" :icon="Search" class="px-4">
      {{ t('common.search_results.empty_title', { query: query.trim() }) }}
      <template #message>{{
        t('common.search_results.empty_message')
      }}</template>
    </BaseEmptyState>

    <div class="h-2" aria-hidden="true"></div>
  </div>
</template>
