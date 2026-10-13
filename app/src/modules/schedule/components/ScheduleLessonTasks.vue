<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { Plus } from '@lucide/vue';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { provideTasks } from '@/modules/tasks/composables/useTasks';
import { useTaskFormModal } from '@/modules/tasks/stores/useTaskFormModal';
import { isDueInLesson } from '@/modules/tasks/utils/dueLesson';
import {
  lessonCourseId,
  lessonSubjectId,
} from '@/modules/schedule/utils/lesson';
import type { Lesson } from '@/modules/schedule/types';
import {
  holdPendingEntrances,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { useCardEntrance } from '@/common/composables/useCardEntrance';
import { entranceDelay } from '@/common/utils/entrance';
import { collapseHeight } from '@/common/utils/collapse';
import TaskCard from '@/modules/tasks/components/TaskCard.vue';
import TaskDialogs from '@/modules/tasks/components/TaskDialogs.vue';
import TaskSkeleton from '@/modules/tasks/components/TaskSkeleton.vue';

const props = defineProps<{
  lesson: Lesson;
  /** The day the lesson takes place, as YYYY-MM-DD. */
  date: string;
  /** Every lesson of that day, with the week's changes applied. */
  dayLessons: readonly Lesson[];
  /** The section's place in the page's entrance; its cards follow it. */
  entranceOrder: number;
}>();

const { t } = useI18n();
const { user } = storeToRefs(useUserStore());
const groupId = useGroupPageId();
const taskFormModal = useTaskFormModal();

// The open tasks, in the task list's order: pinned ones first, then by due date.
const {
  loading,
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
  hideChecked: false,
});

/*
 * A Dalton lesson is time to work on any Dalton task, so it lists all that
 * are open. Any other lesson lists the tasks due in it.
 */
const lessonTasks = computed(() => {
  const lessonOnDate = {
    lesson: props.lesson,
    date: props.date,
    dayLessons: props.dayLessons,
  };
  const courses = user.value?.courses ?? [];
  return filteredItems.value.filter(
    (task) =>
      !dismissedItems.has(task.id) &&
      (props.lesson.isDalton
        ? task.type === 'dalton'
        : isDueInLesson(task, lessonOnDate, courses)),
  );
});

function addTask() {
  if (props.lesson.isDalton) {
    taskFormModal.openNew(groupId, { type: 'dalton', local: true });
    return;
  }
  taskFormModal.openNew(groupId, {
    local: true,
    prefill: {
      subjectId: lessonSubjectId(props.lesson) ?? undefined,
      courseId: lessonCourseId(props.lesson) ?? undefined,
      dueDate: props.date,
    },
  });
}

const showSkeleton = computed(() => loading.value && initialLoad.value);

// Stays in the flow while it folds away, so the rows below follow it up.
function collapseLeavingRow(el: Element, done: () => void) {
  if (!useListTransitions.value) done();
  else collapseHeight(el as HTMLElement, done);
}

const SKELETON_COUNT = 2;
const listEntranceOrder = props.entranceOrder + 1;

const {
  entranceStart: cardEntranceStart,
  isEntering: isCardEntering,
  entranceStyle: cardEntranceStyle,
  handleEntranceEnd: handleCardAnimationEnd,
} = useCardEntrance(
  computed(() => lessonTasks.value.map((task) => task.id)),
  showSkeleton,
  listEntranceOrder,
);
</script>

<template>
  <section class="flex flex-col">
    <div
      class="animate-enter flex items-center justify-between gap-2 mb-2"
      :style="{ '--enter-delay': entranceDelay(entranceOrder) }"
    >
      <h3>
        {{
          lesson.isDalton
            ? t('schedule.lesson.dalton_tasks')
            : t('schedule.lesson.tasks')
        }}
      </h3>
      <BaseButton variant="ghost" :icon="Plus" @click="addTask">
        {{ t('schedule.lesson.add_task') }}
      </BaseButton>
    </div>

    <div class="relative flex flex-col">
      <!-- Taken out of the flow while it fades, so the cards arriving in its
           place overlap it instead of waiting below it. -->
      <Transition
        leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
        leave-to-class="opacity-0"
        @before-leave="holdPendingEntrances"
      >
        <TaskSkeleton
          v-if="showSkeleton"
          :count="SKELETON_COUNT"
          :entrance-order="listEntranceOrder"
          :entrance-start="cardEntranceStart"
        />
      </Transition>

      <template v-if="!showSkeleton">
        <TransitionGroup
          :css="useListTransitions"
          name="task-list"
          tag="div"
          class="flex flex-col relative max-md:-mx-4"
          @leave="collapseLeavingRow"
        >
          <!-- The fragment key prefixes both children's keys, so a separator
               folds away with the card below it and the next one takes over. -->
          <template v-for="(task, index) in lessonTasks" :key="task.id">
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
              :show-type="!lesson.isDalton"
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
          v-if="!loading && listLoadError && lessonTasks.length === 0"
          class="animate-enter"
          @retry="reloadList"
        >
          {{ t('tasks.errors.load') }}
        </BaseLoadError>

        <p
          v-else-if="!loading && lessonTasks.length === 0"
          class="py-6 text-center text-on-ghost-muted animate-enter"
        >
          {{
            lesson.isDalton
              ? t('schedule.lesson.no_dalton_tasks')
              : t('schedule.lesson.no_tasks')
          }}
        </p>
      </template>
    </div>

    <TaskDialogs />
  </section>
</template>

<style scoped>
.task-list-leave-active {
  animation: none !important;
}

.task-list-move {
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
</style>
