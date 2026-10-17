<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarDays, Clock, MapPin } from '@lucide/vue';
import { useImpliedCourse } from '@/modules/courses/composables/useImpliedCourse';
import type { Lesson } from '@/modules/schedule/types';
import {
  lessonCourseId,
  lessonsSlotRange,
  lessonSubjectId,
} from '@/modules/schedule/utils/lesson';

const props = defineProps<{
  lesson: Lesson;
  dayHeading: string;
  time: string;
  getDisplayName: (lesson: Lesson) => string;
}>();

const { t } = useI18n();

/* A cancelled lesson shows only that it is cancelled, not what else changed. */
const shownOriginal = computed(() =>
  props.lesson.cancelled ? undefined : props.lesson._original,
);

const originalName = computed(() => {
  if (!shownOriginal.value) return undefined;
  const name = props.getDisplayName(shownOriginal.value);
  return name === props.getDisplayName(props.lesson) ? undefined : name;
});

const courseIsImplied = useImpliedCourse(() => ({
  subjectId: lessonSubjectId(props.lesson),
  courseId: lessonCourseId(props.lesson),
}));

const roomChanged = computed(
  () => !!shownOriginal.value && props.lesson.room !== shownOriginal.value.room,
);

const periodLabel = computed(() => {
  const { firstSlot, lastSlot } = lessonsSlotRange([props.lesson]);
  return firstSlot === lastSlot
    ? t('schedule.period', { slot: firstSlot })
    : t('schedule.periods', { first: firstSlot, last: lastSlot });
});
</script>

<template>
  <header class="flex flex-col gap-4">
    <div>
      <div class="flex flex-wrap items-baseline gap-x-3">
        <h1
          class="min-w-0 break-words [overflow-wrap:anywhere]"
          :class="{ 'text-on-ghost-muted!': lesson.cancelled }"
        >
          <span
            v-if="originalName"
            class="line-through font-normal text-on-ghost-muted mr-2"
          >
            {{ originalName }}
          </span>
          {{ getDisplayName(lesson) }}
        </h1>
        <span
          v-if="lesson.courseName && !courseIsImplied"
          class="text-xl text-on-ghost-muted"
        >
          {{ lesson.courseName }}
        </span>
      </div>

      <p v-if="lesson.cancelled" class="text-xl font-bold text-danger">
        {{ t('schedule.cancelled') }}
      </p>
    </div>

    <ul class="flex flex-col gap-2 text-lg text-on-ghost">
      <li class="flex items-center gap-3">
        <CalendarDays :size="20" class="shrink-0 text-on-ghost-muted" />
        {{ dayHeading }}
      </li>
      <li class="flex items-center gap-3 tabular-nums">
        <Clock :size="20" class="shrink-0 text-on-ghost-muted" />
        <span>
          {{ time }}
          <span class="text-on-ghost-muted">· {{ periodLabel }}</span>
        </span>
      </li>
      <li v-if="lesson.room || roomChanged" class="flex items-center gap-3">
        <MapPin :size="20" class="shrink-0 text-on-ghost-muted" />
        <span>
          <span
            v-if="roomChanged && shownOriginal?.room"
            class="line-through text-on-ghost-muted mr-2"
          >
            {{ shownOriginal.room }}
          </span>
          <span :class="{ 'font-bold': roomChanged }">{{ lesson.room }}</span>
        </span>
      </li>
    </ul>
  </header>
</template>
