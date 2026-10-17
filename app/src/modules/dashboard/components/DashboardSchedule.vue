<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { ChevronRight, CalendarDays } from '@lucide/vue';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useSchedule } from '@/modules/schedule/composables/useSchedule';
import {
  lessonDisplayName,
  lessonsSlotRange,
} from '@/modules/schedule/utils/lesson';
import { findUpcomingLesson } from '@/modules/schedule/utils/upcomingLesson';
import type { Lesson } from '@/modules/schedule/types';
import ScheduleStartTimeColumn from '@/modules/schedule/components/ScheduleStartTimeColumn.vue';
import ScheduleLessonGroup from '@/modules/schedule/components/ScheduleLessonGroup.vue';
import { entranceDelay } from '@/common/utils/entrance';

const props = defineProps<{
  /** The section's place in the page's entrance; its blocks follow it. */
  entranceOrder: number;
}>();

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const te = i18n.te.bind(i18n);
const locale = i18n.locale;
const { user } = storeToRefs(useUserStore());
const { checkPermission } = useGroups();
const groupId = useGroupPageId();

const {
  lessons,
  effectiveLessons,
  loadingLessons,
  loadingSubs,
  lessonsLoadError,
  retrySchedule,
  schoolWeekSubstitutionsFailed,
  retrySubstitutions,
  scheduleConfig,
  groupedLessons,
  dayLayouts,
} = useSchedule();

const NEXT_LESSON_ENTRANCE_ORDER = props.entranceOrder + 1;
const SUBSTITUTIONS_ENTRANCE_ORDER = props.entranceOrder + 2;
const NEXT_LESSON_REVEAL_ORDER = 0;
const SUBSTITUTIONS_REVEAL_ORDER = 1;

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
</script>

<template>
  <div v-if="isScheduleVisible" class="flex flex-col">
    <BasePageHeader
      class="cursor-pointer animate-enter"
      :style="{ '--enter-delay': entranceDelay(entranceOrder) }"
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
    </BasePageHeader>

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
      @retry="retrySchedule"
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
</template>
