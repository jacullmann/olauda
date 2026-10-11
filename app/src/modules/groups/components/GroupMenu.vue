<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { useI18n } from 'vue-i18n';
import { LogOut, Settings, UserRoundPlus } from '@lucide/vue';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import type { UserGroup } from '@/modules/groups/composables/useGroups';
import type { MenuAnchor } from '@/common/utils/menuAnchor';
import { useGroupMenuActions } from '@/modules/groups/composables/useGroupMenuActions';

const props = defineProps<{
  open: boolean;
  group: UserGroup | null;
  anchor: MenuAnchor | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const isMobile = useIsMobileViewport();
const {
  pending,
  canInviteMembers,
  inviteMember,
  openGroupSettings,
  leaveGroup,
} = useGroupMenuActions();

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

function invite(group: UserGroup) {
  emit('close');
  void inviteMember(group.id);
}

function openSettings(group: UserGroup) {
  emit('close');
  openGroupSettings(group.id);
}

function leave(group: UserGroup) {
  emit('close');
  void leaveGroup(group);
}
</script>

<template>
  <Teleport to="body" :disabled="isMobile">
    <BaseMenu
      ref="menu"
      :open="open && !!group"
      :title="group?.name"
      :class="!isMobile ? 'fixed! z-[10000]! min-w-45' : ''"
      :style="!isMobile ? menuStyles : undefined"
      @close="emit('close')"
    >
      <template v-if="group">
        <BaseMenuButton
          v-if="canInviteMembers(group)"
          :icon="UserRoundPlus"
          :disabled="pending"
          @click="invite(group)"
        >
          {{ t('auth.groups.invite.invite_button_header') }}
        </BaseMenuButton>

        <BaseMenuButton :icon="Settings" @click="openSettings(group)">
          {{ t('common.sidebar.admin') }}
        </BaseMenuButton>

        <BaseMenuDivider />

        <BaseMenuButton
          :icon="LogOut"
          danger
          :disabled="pending"
          @click="leave(group)"
        >
          {{ t('common.header.leave_group') }}
        </BaseMenuButton>
      </template>
    </BaseMenu>
  </Teleport>
</template>
