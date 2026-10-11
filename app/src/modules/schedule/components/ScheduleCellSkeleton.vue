<script setup lang="ts">
import { vEntranceStart } from '@/common/composables/useSkeletonHandoff';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';

defineProps<{
  gridColumn: number;
  /** The row the entrance wave times this cell by. */
  gridRow: number;
  /** Placed in the row the grid names for this slot, see --slot-N-row. */
  slotNumber: number;
  radius: 'md' | 'lg';
  /** Shared with the lessons that replace it, see useSkeletonHandoff. */
  entranceStart: number | null;
}>();
</script>

<!--
  The cell names its end lines: positioned absolutely while it fades out, it
  would otherwise stretch to the grid's edge.
-->
<template>
  <div
    :style="{
      gridColumn: `${gridColumn} / span 1`,
      gridRow: `var(--slot-${slotNumber}-row, ${gridRow}) / span 1`,
    }"
  >
    <!--
      The lesson taking this cell's place picks up the entrance where this box
      has got to, so the box can fade out at once and the two crossfade.
    -->
    <div
      v-entrance-start="entranceStart"
      class="h-full animate-enter"
      :style="{ '--enter-delay': cellEntranceDelay(gridColumn, gridRow) }"
    >
      <BaseSkeleton
        width="full"
        height="full"
        :radius="radius"
        class="h-full min-h-14.5 xs:min-h-13.5"
      />
    </div>
  </div>
</template>
