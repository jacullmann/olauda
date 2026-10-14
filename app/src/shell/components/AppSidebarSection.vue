<script setup lang="ts">
import type { Component } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import AppSidebarButton from './AppSidebarButton.vue';

export interface SidebarSectionPage {
  id: string;
  label: string;
  icon: Component;
  to: RouteLocationRaw;
}

defineProps<{
  label: string;
  icon: Component;
  pages: SidebarSectionPage[];
  activePageId: string | null;
  /** Whether the current route lies inside the section, which shows its pages. */
  open: boolean;
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'select', id: string): void;
}>();

function onPageClick(event: MouseEvent, id: string) {
  // Modified clicks keep the browser's own handling, such as a new tab.
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  emit('select', id);
}
</script>

<template>
  <div
    class="group/section relative flex flex-col rounded-[20px] transition-colors duration-(--duration-sidebar-expand) ease-(--ease-sidebar-expand) data-open:bg-surface-highlight motion-reduce:transition-none"
    :data-open="open || undefined"
  >
    <!-- One marker spans the open section, so its pages read as part of it. -->
    <span
      class="pointer-events-none absolute inset-y-0 -left-2.5 w-1 origin-left scale-x-0 rounded-r-full bg-action transition-transform duration-200 group-data-open/section:scale-x-100"
    ></span>

    <AppSidebarButton
      :label="label"
      :icon="icon"
      :expanded="expanded"
      :active="open"
      :page="!open"
      @click="emit('open')"
    />

    <!-- Rows of 0fr to 1fr animate the list's height without measuring it. -->
    <div
      class="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-(--duration-sidebar-expand) ease-(--ease-sidebar-expand) group-data-open/section:grid-rows-[1fr] group-data-open/section:opacity-100 motion-reduce:transition-none"
      :inert="!open"
    >
      <ul :aria-label="label" class="flex min-h-0 flex-col overflow-hidden">
        <li v-for="page in pages" :key="page.id" class="flex flex-col">
          <BaseTooltip :content="page.label" placement="right">
            <RouterLink v-slot="{ href }" :to="page.to" custom>
              <a
                v-wave
                :href="href"
                :aria-current="activePageId === page.id ? 'page' : undefined"
                class="group relative flex h-9 w-full items-center rounded-full text-on-ghost-muted outline-none transition-hover hover:bg-ghost-hover hover:text-on-ghost aria-[current=page]:bg-ghost-hover aria-[current=page]:text-on-ghost touch-target"
                @click="onPageClick($event, page.id)"
              >
                <span class="flex w-10 shrink-0 justify-center">
                  <component :is="page.icon" :size="16" />
                </span>
                <span
                  class="sidebar-fade ml-0.5 text-sm/5 whitespace-nowrap group-aria-[current=page]:font-medium"
                  :class="expanded ? 'opacity-100' : 'opacity-0'"
                >
                  {{ page.label }}
                </span>
              </a>
            </RouterLink>
          </BaseTooltip>
        </li>
      </ul>
    </div>
  </div>
</template>
