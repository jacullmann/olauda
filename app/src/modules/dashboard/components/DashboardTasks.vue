<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { CheckCircle2, ChevronRight } from '@lucide/vue';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { provideTasks } from '@/modules/tasks/composables/useTasks';
import TaskCard from '@/modules/tasks/components/TaskCard.vue';
import TaskDialogs from '@/modules/tasks/components/TaskDialogs.vue';
import TaskSkeleton from '@/modules/tasks/components/TaskSkeleton.vue';
import {
  holdPendingEntrances,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { useCardEntrance } from '@/common/composables/useCardEntrance';
import { entranceDelay } from '@/common/utils/entrance';
import { collapseHeight } from '@/common/utils/collapse';

const props = defineProps<{
  /** How many of the open tasks to show. */
  count: number;
  /** The section's place in the page's entrance; its cards follow it. */
  entranceOrder: number;
}>();

const { t } = useI18n();
const { user } = storeToRefs(useUserStore());
const groupId = useGroupPageId();

// The open tasks, in the task list's order: pinned ones first, then by due date.
const {
  loading: loadingTasks,
  initialLoad,
  listLoadError,
  reloadList,
  showOldEntries,
  filteredItems,
  openMenuId,
  onMenuAction,
  archiveItem,
  dismissedItems,
  useListTransitions,
  canEdit,
  canDelete,
  canManageNotes,
  canUploadImages,
  isChecked,
  toggleCheck,
  isPinned,
  triggerImageDrop,
} = provideTasks({
  tab: 'all',
  showOldEntries: false,
  subject: '',
  hideChecked: true,
});

const visibleTasks = computed(() =>
  filteredItems.value
    .filter((item) => !dismissedItems.has(item.id))
    .slice(0, props.count),
);

const showTaskSkeleton = computed(
  () => loadingTasks.value && initialLoad.value,
);

// Stays in the flow while it folds away, so the rows below follow it up.
function collapseLeavingRow(el: Element, done: () => void) {
  if (!useListTransitions.value) done();
  else collapseHeight(el as HTMLElement, done);
}

const listEntranceOrder = props.entranceOrder + 1;

const {
  entranceStart: cardEntranceStart,
  isEntering: isCardEntering,
  entranceStyle: cardEntranceStyle,
  handleEntranceEnd: handleCardAnimationEnd,
} = useCardEntrance(
  computed(() => visibleTasks.value.map((task) => task.id)),
  showTaskSkeleton,
  listEntranceOrder,
);
</script>

<template>
  <div class="flex flex-col">
    <BasePageHeader
      class="mb-2! cursor-pointer animate-enter"
      :style="{ '--enter-delay': entranceDelay(entranceOrder) }"
      @click="
        $router.push({
          name: 'group-tasks',
          params: { groupId },
          query: { type: 'all' },
        })
      "
    >
      {{ t('dashboard.tasks_overview.title') }}
      <template #action>
        <div class="size-10 flex items-center justify-center">
          <ChevronRight :size="20" class="text-on-ghost-muted" />
        </div>
      </template>
    </BasePageHeader>

    <div class="relative flex flex-col w-full max-w-192 mx-auto">
      <!-- Taken out of the flow while it fades, so the cards arriving in its
           place overlap it instead of waiting below it. -->
      <Transition
        leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
        leave-to-class="opacity-0"
        @before-leave="holdPendingEntrances"
      >
        <TaskSkeleton
          v-if="showTaskSkeleton"
          :count="count"
          :entrance-order="listEntranceOrder"
          :entrance-start="cardEntranceStart"
        />
      </Transition>

      <template v-if="!showTaskSkeleton">
        <TransitionGroup
          :css="useListTransitions"
          name="task-list"
          tag="div"
          class="flex flex-col relative max-md:-mx-4"
          @leave="collapseLeavingRow"
        >
          <!-- The fragment key prefixes both children's keys, so a separator
               folds away with the card below it and the next one takes over. -->
          <template v-for="(task, index) in visibleTasks" :key="task.id">
            <div
              v-if="index > 0"
              v-entrance-start="cardEntranceStart"
              class="separator ml-11.5 md:ml-10.5 mr-4"
              :class="{ 'animate-enter': isCardEntering(task.id) }"
              :style="cardEntranceStyle(task.id)"
            ></div>
            <TaskCard
              v-entrance-start="cardEntranceStart"
              :class="{ 'animate-enter': isCardEntering(task.id) }"
              :style="cardEntranceStyle(task.id)"
              :item="task"
              show-type
              :is-archive-view="showOldEntries"
              :is-checked="isChecked(task.id)"
              :is-pinned="isPinned(task.id)"
              :is-menu-open="openMenuId === task.id"
              :can-check="!!user"
              :can-upload-images="canUploadImages"
              :can-edit="canEdit(task)"
              :can-add-note="canManageNotes && !task.editorNote"
              :can-delete="canDelete(task)"
              @toggle-check="toggleCheck(task)"
              @swipe="archiveItem(task)"
              @menu-action="(action) => onMenuAction(action, task)"
              @open-menu="openMenuId = task.id"
              @close-menu="openMenuId = null"
              @image-drop="(files) => triggerImageDrop(task, files)"
              @animationend="handleCardAnimationEnd($event, task.id)"
            />
          </template>
        </TransitionGroup>

        <BaseLoadError
          v-if="!loadingTasks && listLoadError && visibleTasks.length === 0"
          class="animate-enter"
          @retry="reloadList"
        >
          {{ t('tasks.errors.load') }}
        </BaseLoadError>

        <div
          v-else-if="!loadingTasks && visibleTasks.length === 0"
          class="text-center py-8 space-y-3 animate-enter"
        >
          <div class="inline-flex p-3 rounded-full bg-success/10 text-success">
            <CheckCircle2 class="size-10" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-on-ghost text-center">
              {{ t('dashboard.tasks_overview.no_tasks') }}
            </h3>
          </div>
        </div>
      </template>
    </div>

    <TaskDialogs />
  </div>
</template>

<style scoped>
.task-list-leave-active {
  animation: none !important;
}

.task-list-move {
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
</style>
