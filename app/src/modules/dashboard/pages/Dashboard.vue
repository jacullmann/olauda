<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { CheckCircle2, ChevronRight, CalendarDays } from '@lucide/vue';

import { useUserStore } from '@/stores/userStore';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useSchedule } from '@/modules/schedule/composables/useSchedule';
import {
  lessonDisplayName,
  lessonsSlotRange,
} from '@/modules/schedule/utils/lesson';
import type { Lesson } from '@/modules/schedule/types';
import ScheduleStartTimeColumn from '@/modules/schedule/components/ScheduleStartTimeColumn.vue';
import ScheduleLessonGroup from '@/modules/schedule/components/ScheduleLessonGroup.vue';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { usePageSettings } from '@/common/composables/usePageSettings';
import { provideTasks } from '@/modules/tasks/composables/useTasks';
import TaskCard from '@/modules/tasks/components/TaskCard.vue';
import TaskDialogs from '@/modules/tasks/components/TaskDialogs.vue';
import TaskSkeleton from '@/modules/tasks/components/TaskSkeleton.vue';
import {
  holdPendingEntrances,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { useCardEntrance } from '@/modules/tasks/composables/useCardEntrance';
import { entranceDelay } from '@/modules/tasks/utils/entrance';
import { collapseHeight } from '@/modules/tasks/utils/collapse';
import { findUpcomingLesson } from '@/modules/schedule/utils/upcomingLesson';

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const te = i18n.te.bind(i18n);
const locale = i18n.locale;
const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const { checkPermission } = useAppAuth();
const groupId = useGroupPageId();
const { settings: dashboardSettings } = usePageSettings('dashboard');

const {
  lessons,
  effectiveLessons,
  loadingLessons,
  loadingSubs,
  lessonsLoadError,
  loadSchedule,
  schoolWeekSubstitutionsFailed,
  retrySubstitutions,
  scheduleConfig,
  groupedLessons,
  dayLayouts,
} = useSchedule();

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

const TASK_COUNT = 3;

const visibleTasks = computed(() =>
  filteredItems.value
    .filter((item) => !dismissedItems.has(item.id))
    .slice(0, TASK_COUNT),
);

const showTaskSkeleton = computed(
  () => loadingTasks.value && initialLoad.value,
);

const now = ref(new Date());

let timerInterval: number | undefined;

onMounted(() => {
  timerInterval = window.setInterval(() => {
    now.value = new Date();
  }, 30000);
});

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});

// Stays in the flow while it folds away, so the rows below follow it up.
function collapseLeavingRow(el: Element, done: () => void) {
  if (!useListTransitions.value) done();
  else collapseHeight(el as HTMLElement, done);
}

const takenCourseIds = computed(
  () => new Set(user.value?.courses.map(({ courseId }) => courseId)),
);

const upcomingLesson = computed(() =>
  findUpcomingLesson(
    effectiveLessons.value,
    scheduleConfig.value,
    takenCourseIds.value,
    now.value,
  ),
);

const getDisplayName = (lesson: Lesson): string =>
  lessonDisplayName(lesson, t, te);

/*
 * The upcoming lesson as its day's phone schedule shows it: the whole cell it
 * shares with parallel courses, beside the time column of the rows it spans.
 */
const upcomingLessonPreview = computed(() => {
  const lesson = upcomingLesson.value;
  if (!lesson) return null;
  const group = groupedLessons.value.find(({ lessons: groupLessons }) =>
    groupLessons.includes(lesson),
  );
  const layout = dayLayouts.value.get(lesson.day);
  if (!group || !layout) return null;

  const { firstSlot, lastSlot } = lessonsSlotRange(group.lessons);
  const firstRow = layout.gridRowOfSlot(firstSlot);
  const lastRow = layout.gridRowOfSlot(lastSlot);
  const rowOffset = firstRow - 1;
  const rows = layout.rows
    .filter((row) => row.gridRow >= firstRow && row.gridRow <= lastRow)
    .map((row) => ({ ...row, gridRow: row.gridRow - rowOffset }));

  return {
    group,
    rows,
    style: {
      ...layout.groupStyle(group.lessons, 2),
      gridRow: `1 / ${rows.length + 1}`,
    },
  };
});

const scheduleChanges = computed(() => {
  const changes = effectiveLessons.value.filter((l) => {
    const orig = l._original;
    if (!orig) return false;
    return l.cancelled || l.isSubstitutedSubject || l.room !== orig.room;
  });

  return [...changes].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.slot - b.slot;
  });
});

const formatDayName = (day: number): string => {
  const date = new Date(Date.UTC(2024, 0, day, 12));
  return new Intl.DateTimeFormat(locale.value, { weekday: 'long' }).format(
    date,
  );
};

const hasLessons = computed(() => lessons.value && lessons.value.length > 0);
const canEditScheduleConfig = computed(() => checkPermission('edit_schedule'));

const loadingSchedule = computed(
  () => loadingLessons.value || loadingSubs.value,
);

const isScheduleVisible = computed(() => {
  if (loadingLessons.value || lessonsLoadError.value) return true;
  return hasLessons.value || canEditScheduleConfig.value;
});

/** Top to bottom: each section's header, then what it holds. */
const TASKS_HEADER_ENTRANCE_ORDER = 1;
const TASKS_LIST_ENTRANCE_ORDER = 2;
const SCHEDULE_HEADER_ENTRANCE_ORDER = TASKS_LIST_ENTRANCE_ORDER + TASK_COUNT;
const NEXT_LESSON_ENTRANCE_ORDER = SCHEDULE_HEADER_ENTRANCE_ORDER + 1;
const SUBSTITUTIONS_ENTRANCE_ORDER = SCHEDULE_HEADER_ENTRANCE_ORDER + 2;
const NEXT_LESSON_REVEAL_ORDER = 0;
const SUBSTITUTIONS_REVEAL_ORDER = 1;

const {
  entranceStart: cardEntranceStart,
  isEntering: isCardEntering,
  entranceStyle: cardEntranceStyle,
  handleEntranceEnd: handleCardAnimationEnd,
} = useCardEntrance(
  computed(() => visibleTasks.value.map((task) => task.id)),
  showTaskSkeleton,
  TASKS_LIST_ENTRANCE_ORDER,
);
</script>

<template>
  <div class="p-4">
    <div class="relative mb-4 animate-enter">
      <Tagline :show-quote="dashboardSettings.tagline" />
    </div>

    <div class="flex flex-col gap-8">
      <div class="flex flex-col">
        <PageHeader
          class="mb-2! cursor-pointer animate-enter"
          :style="{
            '--enter-delay': entranceDelay(TASKS_HEADER_ENTRANCE_ORDER),
          }"
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
        </PageHeader>

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
              :count="TASK_COUNT"
              :entrance-order="TASKS_LIST_ENTRANCE_ORDER"
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
              <div
                class="inline-flex p-3 rounded-full bg-success/10 text-success"
              >
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
      </div>

      <div v-if="isScheduleVisible" class="flex flex-col">
        <PageHeader
          class="cursor-pointer animate-enter"
          :style="{
            '--enter-delay': entranceDelay(SCHEDULE_HEADER_ENTRANCE_ORDER),
          }"
          @click="
            $router.push({
              name: 'group-schedule',
              params: { groupId },
            })
          "
        >
          {{ t('dashboard.schedule_overview.title') }}
          <template v-if="hasLessons" #action>
            <div class="size-10 flex items-center justify-center">
              <ChevronRight :size="20" class="text-on-ghost-muted" />
            </div>
          </template>
        </PageHeader>

        <!-- Each block enters with its heading. Content that replaces a skeleton
             plays its own entrance as well, cascading from when it arrives
             rather than inheriting the block's place in the page. -->
        <div
          v-if="loadingSchedule || hasLessons"
          class="flex-1 flex flex-col gap-6 min-h-55"
        >
          <div
            class="animate-enter"
            :style="{
              '--enter-delay': entranceDelay(NEXT_LESSON_ENTRANCE_ORDER),
            }"
          >
            <h3 class="mb-1!">
              {{ t('dashboard.schedule_overview.next_lesson') }}
            </h3>

            <div class="relative">
              <Transition
                leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
                leave-to-class="opacity-0"
              >
                <!-- The pulse stays off the leaving element: Vue would wait out
                     its infinite animation instead of the fade. -->
                <div v-if="loadingSchedule">
                  <div
                    class="h-20 bg-surface-highlight rounded-xl animate-pulse max-w-192 mx-auto"
                  ></div>
                </div>
              </Transition>

              <template v-if="!loadingSchedule">
                <div
                  v-if="upcomingLessonPreview"
                  class="grid grid-cols-[2.5rem_1fr] gap-2 w-full max-w-192 mx-auto animate-enter"
                  :style="{
                    '--enter-delay': entranceDelay(NEXT_LESSON_REVEAL_ORDER),
                  }"
                >
                  <ScheduleStartTimeColumn
                    :rows="upcomingLessonPreview.rows"
                    :animated="false"
                  />

                  <ScheduleLessonGroup
                    :group="upcomingLessonPreview.group.lessons"
                    :animated="false"
                    :get-display-name="getDisplayName"
                    :style="upcomingLessonPreview.style"
                  />
                </div>

                <div
                  v-else
                  class="p-4 text-center text-xs text-on-ghost-muted animate-enter"
                  :style="{
                    '--enter-delay': entranceDelay(NEXT_LESSON_REVEAL_ORDER),
                  }"
                >
                  {{ t('dashboard.schedule_overview.no_more_lessons') }}
                </div>
              </template>
            </div>
          </div>

          <div
            class="flex-1 flex flex-col animate-enter"
            :style="{
              '--enter-delay': entranceDelay(SUBSTITUTIONS_ENTRANCE_ORDER),
            }"
          >
            <h3 class="mb-1!">
              {{ t('dashboard.schedule_overview.changes') }}
            </h3>

            <div class="relative flex-1 flex flex-col">
              <Transition
                leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
                leave-to-class="opacity-0"
              >
                <div v-if="loadingSchedule">
                  <div
                    class="h-16 w-full max-w-192 mx-auto bg-surface-highlight rounded-xl animate-pulse"
                  ></div>
                </div>
              </Transition>

              <template v-if="!loadingSchedule">
                <div
                  v-if="scheduleChanges.length > 0"
                  class="flex flex-col w-full max-w-192 mx-auto animate-enter"
                  :style="{
                    '--enter-delay': entranceDelay(SUBSTITUTIONS_REVEAL_ORDER),
                  }"
                >
                  <div
                    v-for="(change, index) in scheduleChanges"
                    :key="change.id"
                    class="flex max-sm:flex-col sm:items-center sm:justify-between sm:gap-3 py-3"
                    :class="
                      index !== scheduleChanges.length - 1
                        ? 'border-b border-ghost-border'
                        : ''
                    "
                  >
                    <div class="min-w-0">
                      <span class="text-base text-on-ghost font-medium">
                        {{
                          t('dashboard.schedule_overview.slot', {
                            slot: change.slot,
                          })
                        }}
                        {{ getDisplayName(change) }},
                        {{ formatDayName(change.day) }}
                      </span>
                    </div>

                    <i18n-t
                      v-if="change.room !== change._original?.room"
                      keypath="dashboard.schedule_overview.room_change"
                      tag="span"
                      class="text-on-ghost-muted block"
                    >
                      <template #room>
                        <strong>{{ change.room }}</strong>
                      </template>

                      <template #original>
                        {{ change._original?.room || '?' }}
                      </template>
                    </i18n-t>

                    <span v-if="change.cancelled" class="font-bold text-danger">
                      {{ t('dashboard.schedule_overview.cancelled') }}
                    </span>
                  </div>
                </div>

                <BaseLoadError
                  v-else-if="schoolWeekSubstitutionsFailed"
                  class="w-full max-w-192 mx-auto animate-enter"
                  :style="{
                    '--enter-delay': entranceDelay(SUBSTITUTIONS_REVEAL_ORDER),
                  }"
                  @retry="retrySubstitutions"
                >
                  {{ t('schedule.errors.load_changes') }}
                </BaseLoadError>

                <div
                  v-else
                  class="flex-1 flex items-center justify-center p-4 text-center text-xs text-on-ghost-muted animate-enter"
                  :style="{
                    '--enter-delay': entranceDelay(SUBSTITUTIONS_REVEAL_ORDER),
                  }"
                >
                  {{ t('dashboard.schedule_overview.no_changes') }}
                </div>
              </template>
            </div>
          </div>
        </div>

        <BaseLoadError
          v-else-if="lessonsLoadError"
          class="w-full max-w-192 mx-auto animate-enter"
          @retry="loadSchedule()"
        >
          {{ t('schedule.errors.load') }}
        </BaseLoadError>

        <div
          v-else-if="canEditScheduleConfig"
          class="flex-1 flex items-center justify-center p-6 min-h-55 animate-enter"
        >
          <BaseEmptyState
            :primary-action="
              () =>
                $router.push({
                  name: 'group-admin',
                  params: { groupId, tab: 'schedule' },
                })
            "
            :icon="CalendarDays"
          >
            <template #message>{{
              t('dashboard.schedule_overview.setup_cta')
            }}</template>
            <template #primary-action-label>{{
              t('dashboard.schedule_overview.setup_button')
            }}</template>
          </BaseEmptyState>
        </div>
      </div>
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
