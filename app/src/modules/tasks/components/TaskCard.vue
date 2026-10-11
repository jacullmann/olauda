<script setup lang="ts">
import {
  computed,
  ref,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { Ellipsis, Pin } from '@lucide/vue';
import { useLongPress } from '@/common/composables/useLongPress';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import {
  useSwipeCard,
  type SwipeAction,
} from '@/modules/tasks/composables/useSwipeCard';
import { useFileDrop } from '@/modules/tasks/composables/useFileDrop';
import type { Task, TaskMenuAction } from '@/modules/tasks/types';
import { taskRoute } from '@/modules/tasks/utils/routes';
import { menuAnchor, type MenuAnchor } from '@/common/utils/menuAnchor';
import TaskSwipeActions from './TaskSwipeActions.vue';
import TaskMenu from './TaskMenu.vue';
import TaskMeta from './TaskMeta.vue';

const props = defineProps<{
  item: Task;
  showType: boolean;
  isArchiveView: boolean;
  isChecked: boolean;
  isPinned: boolean;
  isMenuOpen: boolean;
  canCheck: boolean;
  canUploadImages: boolean;
  canAddNote: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-check'): void;
  (e: 'swipe'): void;
  (e: 'menu-action', action: TaskMenuAction): void;
  (e: 'open-menu'): void;
  (e: 'close-menu'): void;
  (e: 'image-drop', files: File[]): void;
}>();

const { t } = useI18n();
const groupId = useGroupPageId();
// On phones the card's menu opens on a long press, which frees the row for the
// title; the task's own page keeps the button.
const isMobile = useIsMobileViewport();

const to = computed(() => taskRoute(groupId, props.item.id));

const menuPosition = ref<MenuAnchor | null>(null);

function openMenuAt(event: MouseEvent) {
  menuPosition.value = menuAnchor(event);
  emit('open-menu');
}

function handleMenuClick(event: MouseEvent) {
  if (props.isMenuOpen) emit('close-menu');
  else openMenuAt(event);
}

watch(
  () => props.isMenuOpen,
  (isOpen) => {
    if (!isOpen) menuPosition.value = null;
  },
);

/** Controls that answer a press themselves, so the card's hold may not. */
const IGNORED_REGIONS = ['button', 'input', '.checkbox', '[role=menu]'].join(
  ', ',
);

const { handlers: longPressHandlers } = useLongPress(openMenuAt, {
  ignore: IGNORED_REGIONS,
  grow: '.item-card',
});

const { isDragOver, handlers: dropHandlers } = useFileDrop(
  (files) => emit('image-drop', files),
  { enabled: () => props.canUploadImages },
);

const startSwipeAction = computed(() => {
  if (!props.canCheck) return undefined;
  return props.isPinned ? 'unpin' : 'pin';
});

const trayAction = computed<SwipeAction>(() => {
  if (activeSide.value === 'left' && startSwipeAction.value)
    return startSwipeAction.value;
  return props.isArchiveView ? 'keep' : 'archive';
});

const card = useTemplateRef<HTMLElement>('card');
const tray = useTemplateRef<ComponentPublicInstance>('tray');

const {
  revealedOffset,
  activeSide,
  isActionsVisible,
  isTakingOver,
  isRevealed,
  cardStyle,
  dismiss,
  close: closeSwipe,
} = useSwipeCard(
  card,
  computed(() => tray.value?.$el ?? null),
  {
    enabled: true,
    hasSecondaryAction: true,
    hasStartAction: () => !!startSwipeAction.value,
    // The list folds the row away together with the separator above it.
    onDismissed: () => emit('swipe'),
    onStartCommit: () => emit('menu-action', 'pin'),
  },
);

function runSwipeAction() {
  if (activeSide.value === 'right') {
    void dismiss();
    return;
  }
  closeSwipe();
  emit('menu-action', 'pin');
}

function runSecondarySwipeAction(event: MouseEvent) {
  closeSwipe();
  openMenuAt(event);
}
</script>

<template>
  <div
    class="long-press-target relative z-20 focus-within:z-30 hover:z-30 has-[[role=menu]]:z-50"
    :data-revealed="isRevealed || undefined"
    v-on="longPressHandlers"
  >
    <TaskSwipeActions
      v-if="isActionsVisible"
      ref="tray"
      :key="activeSide"
      :side="activeSide"
      :action="trayAction"
      :secondary-action="activeSide === 'right' ? 'menu' : undefined"
      :offset="revealedOffset"
      :is-taking-over="isTakingOver"
      @action="runSwipeAction"
      @secondary-action="runSecondarySwipeAction"
    />

    <div
      ref="card"
      v-wave
      class="item-card group/task relative bg-canvas border-ghost-border p-1 cursor-default touch-pan-y outline-2 transition-[outline-color,background-color] duration-(--duration-hover) ease-(--ease-hover) [@media(hover:hover)]:has-[.item-card-link:hover]:bg-ghost-hover has-[.item-card-link:active]:bg-ghost-hover has-[.item-card-link:focus-visible]:shadow-focus-ring"
      :class="[
        isDragOver ? 'outline-accent' : 'outline-transparent',
        isRevealed ? 'rounded-xl bg-ghost-hover' : 'rounded-none md:rounded-xl',
      ]"
      :style="cardStyle"
      v-on="dropHandlers"
    >
      <!-- Not positioned itself: the title's link has to stretch over the
           whole card, so the controls are lifted above it instead. -->
      <div class="flex select-none">
        <div class="flex flex-1 gap-3 min-w-0 mt-2 mx-3 md:mx-2 mb-1.5">
          <span v-if="canCheck" class="relative z-10 flex">
            <BaseCheckbox
              class="checkbox"
              :checked="isChecked"
              @change="$emit('toggle-check')"
            />
          </span>
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3
                class="flex-1 min-w-0 text-lg/6! overflow-hidden text-ellipsis whitespace-nowrap -my-0.75!"
                :title="item.title"
              >
                <RouterLink
                  :to="to"
                  class="item-card-link outline-none after:absolute after:inset-0"
                  >{{ item.title }}</RouterLink
                >
              </h3>

              <Pin
                v-if="isPinned"
                :size="18"
                class="shrink-0 text-on-ghost-muted fill-current"
                aria-hidden="true"
              />

              <!-- Pulled into the title's line box so the row keeps its height.
                   Collapsed rather than display:none, so it stays focusable. -->
              <BaseButton
                v-if="!isMobile"
                variant="ghost"
                size="sm"
                class="z-10 -my-2 -mr-2"
                :class="
                  !isMenuOpen && [
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:w-0',
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:px-0',
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:-ml-2',
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:mr-0',
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:overflow-hidden',
                    '[@media(hover:hover)]:not-group-hover/task:not-focus-visible:opacity-0',
                  ]
                "
                :aria-label="t('common.more')"
                :icon="Ellipsis"
                @click.stop="handleMenuClick"
              />
            </div>

            <TaskMeta :item="item" :show-type="showType" />
          </div>
        </div>

        <TaskMenu
          :open="isMenuOpen"
          :anchor="menuPosition"
          :is-pinned="isPinned"
          :is-in-archive="isArchiveView"
          :can-upload-images="canUploadImages"
          :can-add-note="canAddNote"
          :can-delete="canDelete"
          @action="(action) => $emit('menu-action', action)"
          @close="$emit('close-menu')"
        />
      </div>

      <!-- An inset shadow on the card itself would paint beneath its content. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-10 rounded-[inherit] inset-shadow-drop-target transition-opacity duration-(--duration-focus) ease-(--ease-focus)"
        :class="isDragOver ? 'opacity-100' : 'opacity-0'"
      />
    </div>
  </div>
</template>
