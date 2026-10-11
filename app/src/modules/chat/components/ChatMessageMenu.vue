<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, Trash2, Flag, Reply } from '@lucide/vue';

const { t } = useI18n();

defineProps<{
  activeMessage: any;
  canDelete: boolean;
  contextMenuStyles: any;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'reply', msg: any): void;
  (e: 'copy', msg: any): void;
  (e: 'report', msg: any): void;
  (e: 'delete', msg: any): void;
}>();

const innerMenuRef = ref<any>(null);
const menuEl = computed(() => innerMenuRef.value?.menuEl || null);

defineExpose({
  menuEl,
});
</script>

<template>
  <Teleport to="body" :disabled="isMobile">
    <BaseMenu
      ref="innerMenuRef"
      :open="!!activeMessage"
      :class="!isMobile ? 'fixed! z-[10001]! min-w-45' : ''"
      :style="!isMobile ? contextMenuStyles : undefined"
      @close="emit('close')"
    >
      <template v-if="activeMessage">
        <BaseMenuButton :icon="Reply" @click="emit('reply', activeMessage)">
          {{ t('chat.reply') }}
        </BaseMenuButton>

        <BaseMenuButton :icon="Copy" @click="emit('copy', activeMessage)">
          {{ t('common.buttons.copy') }}
        </BaseMenuButton>

        <BaseMenuDivider />

        <BaseMenuButton
          :title="t('tasks.list.tasks.menu.report.name')"
          :icon="Flag"
          @click="emit('report', activeMessage)"
        >
          {{ t('tasks.list.tasks.menu.report.name') }}
        </BaseMenuButton>

        <BaseMenuButton
          v-if="canDelete"
          danger
          :icon="Trash2"
          @click="emit('delete', activeMessage)"
        >
          {{ t('common.buttons.delete') }}
        </BaseMenuButton>
      </template>
    </BaseMenu>
  </Teleport>
</template>
