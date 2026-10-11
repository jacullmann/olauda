<script setup lang="ts">
import { computed } from 'vue';
import { useLongPress } from '@/common/composables/useLongPress';
import { useAddedEntrance } from '@/modules/tasks/composables/useAddedEntrance';
import type { Attachment } from '@/api/files';
import TaskAttachmentThumbnail from './TaskAttachmentThumbnail.vue';

const props = defineProps<{
  images: Attachment[];
  itemId: string;
}>();

const emit = defineEmits<{
  (e: 'open-viewer', index: number): void;
  (e: 'context-menu', event: MouseEvent, img: Attachment): void;
}>();

const { isEntering, entranceStyle, handleEntranceEnd } = useAddedEntrance(
  computed(() => props.images.map((img) => img.id)),
);

// One hold is tracked for the whole row and resolved to a tile from the event
// target, so the tiles stay plain markup instead of a component each.
const { handlers: longPressHandlers } = useLongPress(
  (event) => {
    const tile = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-image-index]',
    );

    if (!tile) return;

    const img = props.images[Number(tile.dataset.imageIndex)];

    if (img) emit('context-menu', event, img);
  },
  {
    // Only tiles own a menu; the gaps between them belong to the page.
    within: '[data-image-index]',
    grow: '[data-image-index]',
  },
);
</script>

<template>
  <!-- Columns follow the room the grid gets, not the window, which the
       sidebar shares. -->
  <div class="@container">
    <div
      class="grid grid-cols-2 gap-1 @md:grid-cols-3 @2xl:grid-cols-4"
      :data-task-images="itemId"
      v-on="longPressHandlers"
    >
      <div
        v-for="(img, idx) in images"
        :key="img.id"
        :data-image-index="idx"
        class="long-press-target relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border-none bg-black/[0.12] select-none"
        :class="{ 'animate-enter': isEntering(img.id) }"
        :style="entranceStyle(img.id)"
        @animationend="handleEntranceEnd($event, img.id)"
      >
        <button
          type="button"
          class="img-clickable w-full h-full cursor-pointer bg-transparent block touch-target"
          @click.stop="$emit('open-viewer', idx)"
        >
          <TaskAttachmentThumbnail :file="img" />
        </button>
      </div>
    </div>
  </div>
</template>
