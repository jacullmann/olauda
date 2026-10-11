<script setup lang="ts">
import { ref, computed } from 'vue';
import { Upload, Trash2 } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';

const { t } = useI18n();

const props = defineProps<{
  visible?: boolean;
  x: number;
  y: number;
  canUpload: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits(['cancel', 'upload', 'delete']);

const menuRef = ref<HTMLElement | null>(null);

const virtualElement = computed(() => {
  const x = props.x;
  const y = props.y;
  return {
    getBoundingClientRect() {
      return {
        width: 0,
        height: 0,
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
      };
    },
  };
});

const { floatingStyles, isPositioned } = useFloating(virtualElement, menuRef, {
  strategy: 'fixed',
  placement: 'bottom-start',
  whileElementsMounted: autoUpdate,
  transform: false,
  middleware: [offset(4), flip(), shift({ padding: 8 })],
});

const contextMenuStyles = computed(() => ({
  ...floatingStyles.value,
  opacity: isPositioned.value ? undefined : 0,
}));
</script>

<template>
  <Teleport to="body">
    <!-- Above the image viewer, which opens this same menu from its own
         button. On a phone that menu is a sheet, which has its own backdrop to
         lift along, so it takes the elevation as a prop. -->
    <BaseMenu
      :ref="(el: any) => (menuRef = el?.menuEl)"
      :open="visible"
      elevated
      class="fixed! z-[100003]! min-w-45"
      :style="contextMenuStyles"
      @close="emit('cancel')"
    >
      <BaseMenuButton v-if="canUpload" :icon="Upload" @click="emit('upload')">
        {{ t('tasks.list.tasks.menu.upload_images') }}
      </BaseMenuButton>

      <BaseMenuButton
        v-if="canDelete"
        danger
        :icon="Trash2"
        @click="emit('delete')"
      >
        {{ t('common.buttons.delete') }}
      </BaseMenuButton>
    </BaseMenu>
  </Teleport>
</template>
