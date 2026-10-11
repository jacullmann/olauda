<script setup lang="ts">
import { computed, useId } from 'vue';
import type { ThemeMode } from '@/common/composables/useTheme';
import {
  themePreviewPalettes,
  type ThemePreviewScene,
} from '@/modules/account/utils/themePreviewPalettes';
import AccountThemePreviewDesktop from './AccountThemePreviewDesktop.vue';
import AccountThemePreviewPhone from './AccountThemePreviewPhone.vue';

const props = defineProps<{ theme: ThemeMode }>();

const scenes = computed<ThemePreviewScene[]>(() =>
  props.theme === 'system' ? ['light', 'dark'] : [props.theme],
);

const darkHalfId = useId();

// Each screen size previews its own layout; CSS picks one, so resizing needs no script.
const layouts = [
  {
    name: 'phone',
    component: AccountThemePreviewPhone,
    width: 72,
    height: 96,
    // In viewBox units: each corner element's inset plus its own radius, so the
    // header, avatar and tab bar curve concentric with the frame at any size.
    cornerRadius: 10,
    visibility: 'md:hidden',
  },
  {
    name: 'desktop',
    component: AccountThemePreviewDesktop,
    width: 120,
    height: 80,
    visibility: 'max-md:hidden',
  },
] as const;

const [phoneLayout] = layouts;

// Percentages of the frame's width and height scale the radius with the tile,
// which shrinks with the screen on phones.
const phoneCornerRadius = `${(phoneLayout.cornerRadius / phoneLayout.width) * 100}% / ${(phoneLayout.cornerRadius / phoneLayout.height) * 100}%`;
</script>

<template>
  <span
    class="relative block overflow-hidden rounded-(--phone-corner-radius) md:rounded-xl after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-ghost-border"
    :style="{ '--phone-corner-radius': phoneCornerRadius }"
  >
    <svg
      v-for="layout in layouts"
      :key="layout.name"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      class="block w-full h-auto"
      :class="layout.visibility"
      aria-hidden="true"
      focusable="false"
    >
      <defs v-if="scenes.length > 1">
        <clipPath :id="`${darkHalfId}-${layout.name}`">
          <rect
            :x="layout.width / 2"
            :width="layout.width / 2"
            :height="layout.height"
          />
        </clipPath>
      </defs>

      <g
        v-for="(scene, index) in scenes"
        :key="scene"
        :clip-path="
          index > 0 ? `url(#${darkHalfId}-${layout.name})` : undefined
        "
      >
        <component
          :is="layout.component"
          :palette="themePreviewPalettes[scene]"
        />
      </g>
    </svg>
  </span>
</template>
