<script setup lang="ts">
import type { ThemePreviewPalette } from '@/modules/account/utils/themePreviewPalettes';

defineProps<{ palette: ThemePreviewPalette }>();

// The last row runs off the bottom edge, so the preview reads as a crop of a
// longer page rather than a shrunken one.
const rows = [
  { y: 26, width: 36, metaWidth: 14 },
  { y: 40, width: 46, metaWidth: 11 },
  { y: 54, width: 30, metaWidth: 14 },
  { y: 68, width: 40, metaWidth: 11 },
];
</script>

<template>
  <rect width="120" height="80" :class="palette.canvas" />

  <rect width="16" height="80" :class="palette.surface" />
  <path
    d="M16 0V80"
    :class="palette.border"
    vector-effect="non-scaling-stroke"
  />

  <rect
    x="24"
    y="8.75"
    width="28"
    height="4.5"
    rx="2.25"
    :class="palette.text"
  />

  <g v-for="(row, index) in rows" :key="row.y">
    <rect
      x="32"
      :y="row.y"
      :width="row.width"
      height="2.5"
      rx="1.25"
      :class="palette.text"
    />
    <rect
      x="32"
      :y="row.y + 4.5"
      width="16"
      height="2"
      rx="1"
      :class="palette.muted"
    />
    <rect
      :x="104 - row.metaWidth"
      :y="row.y + 4.5"
      :width="row.metaWidth"
      height="2"
      rx="1"
      :class="palette.muted"
    />
    <path
      v-if="index < rows.length - 1"
      :d="`M32 ${row.y + 10.25}H104`"
      :class="palette.border"
      vector-effect="non-scaling-stroke"
    />
  </g>
</template>
