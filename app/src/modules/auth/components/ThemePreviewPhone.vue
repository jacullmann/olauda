<script setup lang="ts">
import type { ThemePreviewPalette } from '@/modules/auth/utils/themePreviewPalettes';

defineProps<{ palette: ThemePreviewPalette }>();

// The last row keeps its separator, so the list reads as continuing under the
// tab bar. The bar keeps the same gap to the bottom edge as to the sides, like
// AppTabBar, sized so that gap plus its radius meets the frame's corner radius.
const rows = [
  { y: 24, width: 30, metaWidth: 10 },
  { y: 38, width: 38, metaWidth: 8 },
  { y: 52, width: 24, metaWidth: 12 },
  { y: 66, width: 32, metaWidth: 10 },
];

const tabCenters = [13.125, 28.375, 43.625, 58.875];
</script>

<template>
  <rect width="72" height="96" :class="palette.canvas" />

  <rect x="7" y="7" width="24" height="6" rx="3" :class="palette.text" />
  <circle cx="62" cy="10" r="4" :class="palette.muted" />

  <g v-for="(row, index) in rows" :key="row.y">
    <rect
      x="10"
      :y="row.y"
      :width="row.width"
      height="2.5"
      rx="1.25"
      :class="palette.text"
    />
    <rect
      x="10"
      :y="row.y + 4.5"
      width="14"
      height="2"
      rx="1"
      :class="palette.muted"
    />
    <rect
      :x="62 - row.metaWidth"
      :y="row.y + 4.5"
      :width="row.metaWidth"
      height="2"
      rx="1"
      :class="palette.muted"
    />
    <path
      v-if="index < rows.length - 1"
      :d="`M10 ${row.y + 10.25}H62`"
      :class="palette.border"
      vector-effect="non-scaling-stroke"
    />
  </g>

  <rect
    x="4"
    y="80"
    width="64"
    height="12"
    rx="6"
    :class="[palette.surface, palette.border]"
    vector-effect="non-scaling-stroke"
  />
  <rect
    x="5.5"
    y="81.5"
    width="15.25"
    height="9"
    rx="4.5"
    :class="palette.highlight"
  />
  <circle
    v-for="(cx, index) in tabCenters"
    :key="cx"
    :cx="cx"
    cy="86"
    r="3"
    :class="index === 0 ? palette.text : palette.muted"
  />
</template>
