<script setup lang="ts">
import {
  Pencil,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock as LockIcon,
} from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import type { Todo } from '@/modules/todos/types';
import { useTodos } from '@/modules/todos/composables/useTodos';
import {
  useDragReorder,
  REORDER_ITEM_ATTR,
} from '@/common/composables/useDragReorder';
import TodoCard from './TodoCard.vue';
import { useTodoFormModal } from '@/modules/todos/stores/useTodoFormModal';
import { computed, ref, watch } from 'vue';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import {
  holdPendingEntrances,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { useCardEntrance } from '@/common/composables/useCardEntrance';
import { entranceDelay, hasSettledEntrance } from '@/common/utils/entrance';
import { useDismissibleNotice } from '@/modules/account/composables/useDismissibleNotice';

const { t } = useI18n();

const todoFormModal = useTodoFormModal();

const {
  user,
  displayPrivateTasks,
  loading,
  openMenuId,
  togglePrivateTaskCompletion,
  duplicatePrivateTask,
  confirmDeletePrivateTask,
  deletePrivateTask,
  reorderPrivateTask,
} = useTodos();

const isMobile = useIsMobileViewport();

const menuCoords = ref<{ x: number; y: number } | null>(null);
const menuRef = ref<HTMLElement | null>(null);

const menuVirtualElement = computed(() => {
  if (!menuCoords.value) return null;
  const { x, y } = menuCoords.value;
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

const { floatingStyles, isPositioned } = useFloating(
  menuVirtualElement,
  menuRef,
  {
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
  },
);

const itemMenuStyles = computed(() => ({
  ...floatingStyles.value,
  opacity: isPositioned.value ? undefined : 0,
}));

function handleCardMenuClick(privateTask: Todo, event: MouseEvent) {
  if (openMenuId.value === privateTask.id) {
    openMenuId.value = null;
    menuCoords.value = null;
  } else {
    menuCoords.value = { x: event.clientX, y: event.clientY };
    openMenuId.value = privateTask.id;
  }
}

function handleCardContextMenu(privateTask: Todo, event: MouseEvent) {
  menuCoords.value = { x: event.clientX, y: event.clientY };
  openMenuId.value = privateTask.id;
}

watch(openMenuId, (newVal) => {
  if (newVal === null) {
    menuCoords.value = null;
    menuRef.value = null;
  }
});

const IGNORED_REGIONS =
  ".item-menu-trigger, input, textarea, button, a, .checkbox, [role='button'], [role='menu']";

const listRef = ref<HTMLElement | null>(null);

const reorder = useDragReorder(listRef, {
  onMove: reorderPrivateTask,
  ignore: IGNORED_REGIONS,
});
const { isDragging: isReordering } = reorder;

function handleItemDoubleClick(task: Todo, event: MouseEvent) {
  if (!user.value) return;
  if ((event.target as HTMLElement).closest(IGNORED_REGIONS)) return;
  togglePrivateTaskCompletion(task);
}

/** After the page header: the login or privacy notice, then the list. */
const NOTICE_ENTRANCE_ORDER = 1;
const LIST_ENTRANCE_ORDER = 2;
const SKELETON_COUNT = 10;

const showSkeleton = loading;

const privacyNotice = useDismissibleNotice('privateTasks');

const {
  entranceStart: cardEntranceStart,
  isEntering: isCardEntering,
  entranceStyle: cardEntranceStyle,
  handleEntranceEnd: handleCardAnimationEnd,
} = useCardEntrance(
  computed(() => displayPrivateTasks.value.map((task) => task.id)),
  showSkeleton,
  LIST_ENTRANCE_ORDER,
);

const emptyStateEntered = ref(false);

function handleEmptyStateAnimationEnd(event: AnimationEvent) {
  if (hasSettledEntrance(event)) emptyStateEntered.value = true;
}
</script>

<template>
  <div class="private-task-app-integrated flex flex-col">
    <div
      v-if="!user"
      class="private-task-header animate-enter p-8 text-center"
      :style="{ '--enter-delay': entranceDelay(NOTICE_ENTRANCE_ORDER) }"
    >
      <p>{{ t('tasks.private_tasks.requires_account') }}</p>
    </div>

    <BaseNotice
      :show="!!user && !privacyNotice.isDismissed.value"
      :icon="LockIcon"
      class="mt-4 w-full max-w-192 mx-auto"
      :style="{ '--enter-delay': entranceDelay(NOTICE_ENTRANCE_ORDER) }"
      @dismiss="privacyNotice.dismiss"
    >
      {{ t('tasks.private_tasks.only_visible_to_you') }}
    </BaseNotice>

    <div v-if="user" class="private-task-list relative flex flex-1 flex-col">
      <!-- Taken out of the flow while it fades, so the cards arriving in its
           place overlap it instead of waiting below it. -->
      <Transition
        leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
        leave-to-class="opacity-0"
        @before-leave="holdPendingEntrances"
      >
        <!-- Mirrors TodoCard's border and padding, so each line sits
             where its content will. -->
        <div
          v-if="showSkeleton"
          class="flex flex-col gap-3 pt-4 w-full max-w-192 mx-auto"
        >
          <div
            v-for="n in SKELETON_COUNT"
            :key="n"
            v-entrance-start="cardEntranceStart"
            class="animate-enter border border-transparent p-1"
            :style="{
              '--enter-delay': entranceDelay(LIST_ENTRANCE_ORDER + n - 1),
            }"
          >
            <BaseSkeleton width="60" height="20px" class="mt-2 mx-2 mb-2" />
            <div class="mx-2 mb-1">
              <BaseSkeleton width="full" height="16px" class="mb-2" />
              <BaseSkeleton
                width="[70%]"
                height="16px"
                class="hidden md:flex"
              />
            </div>
          </div>
        </div>
      </Transition>

      <template v-if="!showSkeleton">
        <BaseEmptyState
          v-if="displayPrivateTasks.length === 0"
          class="flex-1 p-12 text-center text-on-ghost-muted"
          :class="{ 'animate-enter': !emptyStateEntered }"
          :style="{ '--enter-delay': entranceDelay(LIST_ENTRANCE_ORDER) }"
          @animationend="handleEmptyStateAnimationEnd"
        >
          {{ t('tasks.private_tasks.no_tasks') }}
        </BaseEmptyState>

        <div v-else class="private-tasks-container">
          <div ref="listRef" class="flex flex-col gap-3 pt-4 max-w-192 mx-auto">
            <div
              v-for="(privateTask, index) in displayPrivateTasks"
              :key="privateTask.id"
              v-bind="{ [REORDER_ITEM_ATTR]: '' }"
              class="reorder-item long-press-target relative rounded-xl"
            >
              <!-- The entrance plays on the card, not the wrapper, whose
                 transform belongs to the drag reorder. -->
              <TodoCard
                v-entrance-start="cardEntranceStart"
                :class="{ 'animate-enter': isCardEntering(privateTask.id) }"
                :style="cardEntranceStyle(privateTask.id)"
                :task="privateTask"
                :swipeable="!isReordering"
                :confirm-delete="confirmDeletePrivateTask"
                @toggle-completion="togglePrivateTaskCompletion(privateTask)"
                @delete="deletePrivateTask(privateTask.id, { confirm: false })"
                @edit="todoFormModal.openEdit(privateTask)"
                @dblclick="handleItemDoubleClick(privateTask, $event)"
                @contextmenu.prevent.stop="
                  handleCardContextMenu(privateTask, $event)
                "
                @menu-click="handleCardMenuClick(privateTask, $event)"
                @animationend="handleCardAnimationEnd($event, privateTask.id)"
              >
                <template #menu>
                  <Teleport to="body" :disabled="isMobile">
                    <BaseMenu
                      :ref="
                        (el: any) => {
                          if (el && openMenuId === privateTask.id)
                            menuRef = el.menuEl;
                        }
                      "
                      :open="openMenuId === privateTask.id"
                      :class="!isMobile ? 'fixed! z-[10000]! min-w-45' : ''"
                      :style="!isMobile ? itemMenuStyles : undefined"
                      @close="openMenuId = null"
                      @click.stop
                    >
                      <BaseMenuButton
                        :icon="Pencil"
                        @click="
                          todoFormModal.openEdit(privateTask);
                          openMenuId = null;
                        "
                      >
                        {{ t('common.buttons.edit') }}
                      </BaseMenuButton>

                      <BaseMenuButton
                        :icon="Copy"
                        @click="
                          duplicatePrivateTask(privateTask);
                          openMenuId = null;
                        "
                      >
                        {{ t('common.buttons.duplicate') }}
                      </BaseMenuButton>

                      <BaseMenuDivider />

                      <BaseMenuButton
                        v-if="index > 0"
                        :icon="ChevronUp"
                        @click="
                          reorder.move(index, index - 1);
                          openMenuId = null;
                        "
                      >
                        {{ t('tasks.private_tasks.menu.up') }}
                      </BaseMenuButton>

                      <BaseMenuButton
                        v-if="index < displayPrivateTasks.length - 1"
                        :icon="ChevronDown"
                        @click="
                          reorder.move(index, index + 1);
                          openMenuId = null;
                        "
                      >
                        {{ t('tasks.private_tasks.menu.down') }}
                      </BaseMenuButton>

                      <BaseMenuDivider
                        v-if="
                          index > 0 || index < displayPrivateTasks.length - 1
                        "
                      />

                      <BaseMenuButton
                        :icon="Trash2"
                        danger
                        @click="
                          deletePrivateTask(privateTask.id);
                          openMenuId = null;
                        "
                      >
                        {{ t('common.buttons.delete') }}
                      </BaseMenuButton>
                    </BaseMenu>
                  </Teleport>
                </template>
              </TodoCard>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
