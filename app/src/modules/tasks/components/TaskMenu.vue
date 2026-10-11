<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { useI18n } from 'vue-i18n';
import {
  Paperclip,
  Share,
  Flag,
  Trash2,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Info,
  MessageSquarePlus,
} from '@lucide/vue';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import type { TaskMenuAction } from '@/modules/tasks/types';
import type { MenuAnchor } from '@/common/utils/menuAnchor';

const props = defineProps<{
  open: boolean;
  anchor: MenuAnchor | null;
  isPinned: boolean;
  isInArchive: boolean;
  canUploadImages: boolean;
  canAddNote: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', action: TaskMenuAction): void;
  (e: 'close'): void;
}>();

const { t } = useI18n();
const isMobile = useIsMobileViewport();

const menu = useTemplateRef<{ menuEl: HTMLElement | null }>('menu');
const menuEl = computed(() => menu.value?.menuEl ?? null);

// Without a reference while closed, the menu stops tracking its position.
const anchorElement = computed(() => {
  if (!props.open || !props.anchor) return null;
  const { x, y } = props.anchor;
  return {
    getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
  };
});

const { floatingStyles, isPositioned } = useFloating(anchorElement, menuEl, {
  strategy: 'fixed',
  placement: 'bottom-start',
  whileElementsMounted: autoUpdate,
  transform: false,
  middleware: [
    offset(4),
    flip({
      fallbackPlacements: ['bottom-end', 'top-start', 'top-end'],
    }),
    shift({ padding: 8 }),
  ],
});

const menuStyles = computed(() => ({
  ...floatingStyles.value,
  opacity: isPositioned.value ? undefined : 0,
}));

function select(action: TaskMenuAction) {
  emit('action', action);
}
</script>

<template>
  <Teleport to="body" :disabled="isMobile">
    <BaseMenu
      ref="menu"
      :open="open"
      :class="!isMobile ? 'fixed! z-[10000]! min-w-45' : ''"
      :style="!isMobile ? menuStyles : undefined"
      @close="$emit('close')"
      @click.stop
    >
      <BaseMenuButton
        v-if="canUploadImages"
        :icon="Paperclip"
        @click="select('images')"
      >
        {{ t('tasks.list.tasks.menu.upload_images') }}
      </BaseMenuButton>

      <BaseMenuButton
        v-if="canAddNote"
        :icon="MessageSquarePlus"
        @click="select('addNote')"
      >
        {{ t('tasks.list.tasks.menu.add_note') }}
      </BaseMenuButton>

      <BaseMenuDivider v-if="canUploadImages || canAddNote" />

      <BaseMenuButton :icon="isPinned ? PinOff : Pin" @click="select('pin')">
        {{
          isPinned
            ? t('tasks.list.tasks.menu.unpin')
            : t('tasks.list.tasks.menu.pin')
        }}
      </BaseMenuButton>

      <BaseMenuButton
        :icon="isInArchive ? ArchiveRestore : Archive"
        @click="select('archive')"
      >
        {{
          isInArchive
            ? t('tasks.list.tasks.menu.unarchive')
            : t('tasks.list.tasks.menu.archive')
        }}
      </BaseMenuButton>

      <BaseMenuDivider />

      <BaseMenuButton :icon="Share" @click="select('share')">
        {{ t('tasks.list.tasks.menu.share') }}
      </BaseMenuButton>

      <BaseMenuButton :icon="Info" @click="select('info')">
        {{ t('tasks.list.tasks.menu.info') }}
      </BaseMenuButton>

      <BaseMenuDivider />

      <BaseMenuButton :icon="Flag" @click="select('report')">
        {{ t('tasks.list.tasks.menu.report.name') }}
      </BaseMenuButton>

      <BaseMenuButton
        v-if="canDelete"
        danger
        :icon="Trash2"
        @click="select('delete')"
      >
        {{ t('common.buttons.delete') }}
      </BaseMenuButton>
    </BaseMenu>
  </Teleport>
</template>
