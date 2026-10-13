<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronLeft } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useScheduleLesson } from '@/modules/schedule/composables/useScheduleLesson';
import { scheduleLessonRoute } from '@/modules/schedule/utils/routes';
import { entranceDelay } from '@/common/utils/entrance';

import ScheduleChangeModal from '@/modules/schedule/components/ScheduleChangeModal.vue';
import ScheduleLessonSummary from '@/modules/schedule/components/ScheduleLessonSummary.vue';
import ScheduleLessonTasks from '@/modules/schedule/components/ScheduleLessonTasks.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const groupId = useGroupPageId();

// Followed only while the page is shown, not as it leaves for another route.
const date = ref(String(route.params.date));
const lessonId = ref(String(route.params.lessonId));
onBeforeRouteUpdate((to) => {
  date.value = String(to.params.date);
  lessonId.value = String(to.params.lessonId);
});

const {
  weekStart,
  loading,
  loadError,
  loadSchedule,
  changesFailed,
  retrySubstitutions,
  getDisplayName,
  lesson,
  lessonDate,
  dayLessons,
  dayHeading,
  time,
  scheduledLesson,
  scheduledDayHeading,
  existingChange,
  changesLoaded,
  reloadChanges,
} = useScheduleLesson(date, lessonId);

/** The top bar, then the lesson, then its tasks. */
const SUMMARY_ENTRANCE_ORDER = 1;
const TASKS_ENTRANCE_ORDER = 2;

function goToSchedule() {
  void router.push({
    name: 'group-schedule',
    params: { groupId },
    query: { date: lessonDate.value ?? date.value },
  });
}

/**
 * Stepping back keeps the history as it was, and the schedule where it was
 * left. A lesson opened from a link has nothing of this app behind it.
 */
function leave() {
  if (router.options.history.state.back) router.back();
  else goToSchedule();
}

// A change can move the lesson to another day, which its URL then follows.
watch(lessonDate, (actualDate) => {
  if (actualDate && actualDate !== date.value) {
    void router.replace(
      scheduleLessonRoute(groupId, actualDate, lessonId.value),
    );
  }
});

const { checkPermission } = useGroups();
const canManageScheduleChanges = computed(() =>
  checkPermission('manage_schedule_changes'),
);

const isChanging = ref(false);

function onChangeSaved() {
  isChanging.value = false;
  void reloadChanges();
}

// Every navigation resets the title, also one that only moves the lesson.
watch(
  [lesson, () => route.fullPath],
  ([shownLesson]) => {
    if (shownLesson && route.name === 'group-schedule-lesson') {
      document.title = `${getDisplayName(shownLesson)} | Olauda`;
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.scrollTo({ top: 0, behavior: 'instant' });
});
</script>

<template>
  <div class="flex flex-1 flex-col p-4">
    <div class="flex w-full max-w-192 flex-1 flex-col mx-auto">
      <div class="animate-enter flex items-center justify-between gap-2 mb-6">
        <BaseTooltip :content="t('common.buttons.back')" placement="bottom">
          <BaseButton
            variant="ghost"
            :aria-label="t('common.buttons.back')"
            :icon="ChevronLeft"
            @click="leave"
          />
        </BaseTooltip>

        <BaseButton
          v-if="canManageScheduleChanges && lesson"
          variant="ghost"
          :disabled="!changesLoaded"
          @click="isChanging = true"
        >
          {{ t('schedule.lesson.change') }}
        </BaseButton>
      </div>

      <BaseLoadError
        v-if="changesFailed && lesson"
        class="mb-4"
        @retry="retrySubstitutions"
      >
        {{ t('schedule.errors.load_changes') }}
      </BaseLoadError>

      <div v-if="lesson && lessonDate" class="flex flex-col gap-10">
        <ScheduleLessonSummary
          class="animate-enter"
          :style="{ '--enter-delay': entranceDelay(SUMMARY_ENTRANCE_ORDER) }"
          :lesson="lesson"
          :day-heading="dayHeading"
          :time="time"
          :get-display-name="getDisplayName"
        />

        <ScheduleLessonTasks
          :lesson="lesson"
          :date="lessonDate"
          :day-lessons="dayLessons"
          :entrance-order="TASKS_ENTRANCE_ORDER"
        />
      </div>

      <BaseLoadError
        v-else-if="loadError"
        class="animate-enter"
        @retry="loadSchedule()"
      >
        {{ t('schedule.errors.load') }}
      </BaseLoadError>

      <BaseEmptyState
        v-else-if="!loading"
        class="flex-1 animate-enter"
        :primary-action="goToSchedule"
      >
        {{ t('schedule.lesson.not_found') }}
        <template #message>{{
          t('schedule.lesson.not_found_message')
        }}</template>
        <template #primary-action-label>{{
          t('schedule.lesson.back_to_schedule')
        }}</template>
      </BaseEmptyState>

      <div
        v-else
        class="animate-enter flex flex-col gap-3"
        :style="{ '--enter-delay': entranceDelay(SUMMARY_ENTRANCE_ORDER) }"
        aria-busy="true"
      >
        <BaseSkeleton width="[50%]" height="32px" class="mb-2" />
        <BaseSkeleton width="[45%]" height="20px" />
        <BaseSkeleton width="[35%]" height="20px" />
        <BaseSkeleton width="[20%]" height="20px" />
      </div>
    </div>

    <ScheduleChangeModal
      v-if="canManageScheduleChanges"
      :lesson="isChanging ? scheduledLesson : null"
      :change="existingChange"
      :week-start="weekStart"
      :day-label="scheduledDayHeading"
      @close="isChanging = false"
      @saved="onChangeSaved"
    />
  </div>
</template>
