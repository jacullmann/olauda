<script setup lang="ts">
import { computed } from 'vue';
import { Plus } from '@lucide/vue';
import type {
  Lesson,
  ScheduleConfig,
  ScheduleLayout,
  ScheduleSubject,
} from '@/modules/schedule/types';
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';
import { useSchedulePager } from '@/modules/schedule/composables/useSchedulePager';
import { cellEntranceDelay } from '@/modules/schedule/utils/entrance';
import {
  buildScheduleLayout,
  lessonRowsOf,
} from '@/modules/schedule/utils/layout';
import { daysSinceMonday } from '@/modules/schedule/utils/weekday';
import {
  groupOverlappingLessons,
  lessonGroupsByDay,
  lessonSpan,
  resolveLessonSubject,
  subjectsById,
} from '@/modules/schedule/utils/lesson';

import ScheduleGrid from '@/modules/schedule/components/ScheduleGrid.vue';
import ScheduleLessonGroup from '@/modules/schedule/components/ScheduleLessonGroup.vue';

const { days, scheduleConfig, getDisplayName } = useScheduleDisplay();

const props = withDefaults(
  defineProps<{
    lessons: Lesson[];
    subjects?: ScheduleSubject[];
    selectedLessonIds?: ReadonlySet<string>;
    isEditable?: boolean;
    animated?: boolean;
    individualCourses?: boolean;
    /** The group's saved configuration by default. */
    config?: ScheduleConfig;
  }>(),
  {
    subjects: undefined,
    selectedLessonIds: undefined,
    animated: true,
    isEditable: false,
    individualCourses: false,
    config: undefined,
  },
);

const emit = defineEmits<{
  (e: 'select-lesson', lesson: Lesson, event?: MouseEvent): void;
  (e: 'select-day', day: number, event?: MouseEvent): void;
  (e: 'add-lesson', payload: { day: number; slot: number }): void;
  (e: 'contextmenu-lesson', lesson: Lesson, event: UIEvent): void;
}>();

const shownConfig = computed(() => props.config ?? scheduleConfig.value);

const layout = computed(() => buildScheduleLayout(shownConfig.value, days));

const dayLayouts = computed(
  () =>
    new Map(
      days.map((day) => [day, buildScheduleLayout(shownConfig.value, [day])]),
    ),
);

const dayLayoutOf = (day: number) => dayLayouts.value.get(day) ?? layout.value;

const displayLessons = computed(() => {
  if (!props.lessons || props.lessons.length === 0) return [];
  if (!props.subjects || props.subjects.length === 0) return props.lessons;

  const subjectMap = subjectsById(props.subjects);

  return props.lessons.map((lesson) => {
    const { subjects, courses, ownCourse } = resolveLessonSubject(
      lesson,
      subjectMap,
    );

    // A lesson bound to a course speaks for itself; only lessons that stand for
    // every course of their subject get the summarised course info.
    if (ownCourse) {
      return {
        ...lesson,
        courseId: ownCourse.id,
        courseName: ownCourse.name,
        courses: ownCourse,
        subjects,
      };
    }

    if (props.individualCourses || courses.length > 1) {
      return {
        ...lesson,
        ...(courses.length > 1 && !props.individualCourses
          ? { courseCount: courses.length }
          : {}),
        subjects,
      };
    }

    const [c] = courses;
    if (c) {
      return {
        ...lesson,
        courseId: c.id,
        courseName: c.name,
        courses: { id: c.id, name: c.name },
        subjects,
      };
    }

    return {
      ...lesson,
      subjects,
    };
  });
});

const lessonGroupsOfDay = computed(() =>
  lessonGroupsByDay(groupOverlappingLessons(displayLessons.value)),
);

const lessonGroupsOf = (day: number) => lessonGroupsOfDay.value.get(day) ?? [];

const coveredSlots = computed(() => {
  const set = new Set<string>();
  props.lessons.forEach((lesson) => {
    const slot = Number(lesson.slot);
    for (let i = 0; i < lessonSpan(lesson); i++) {
      set.add(`${lesson.day}-${slot + i}`);
    }
  });
  return set;
});

const emptyRowsOf = (day: number, dayLayout: ScheduleLayout) =>
  lessonRowsOf(dayLayout).filter(
    (row) => !coveredSlots.value.has(`${day}-${row.slot}`),
  );

// Adds another lesson to a slot that is already taken, which in an Abitur
// group is how a second course of the same hour gets scheduled.
const onAddToGroup = (group: Lesson[]) => {
  const [first] = group;
  if (!first) return;
  emit('add-lesson', { day: first.day, slot: first.slot });
};

const dayPager = useSchedulePager(days.length);
const todayIndex = daysSinceMonday(new Date());
dayPager.showPage(todayIndex < days.length ? todayIndex : 0);

const entranceStyle = (
  group: Lesson[],
  column: number,
  dayLayout: ScheduleLayout,
) => ({
  '--enter-delay': cellEntranceDelay(
    column,
    dayLayout.gridRowOfSlot(group[0]?.slot ?? 1),
  ),
});
</script>

<template>
  <ScheduleGrid
    :pager="dayPager"
    :layout="layout"
    :day-layout="dayLayoutOf"
    :clickable-days="isEditable"
    :animated="animated"
    bleed-class="-mx-6 px-6"
    @select-day="(day, event) => emit('select-day', day, event)"
  >
    <template
      #default="{ day, column, layout: dayLayout, animated: cellsAnimated }"
    >
      <ScheduleLessonGroup
        v-for="{ key, lessons: group } in lessonGroupsOf(day)"
        :key="key"
        :group="group"
        :is-clickable="isEditable"
        :has-context-menu="isEditable"
        :selected-lesson-ids="selectedLessonIds"
        :animated="cellsAnimated"
        :can-add-lesson="isEditable && individualCourses"
        :time="dayLayout.differingTimeOf(group)"
        :get-display-name="getDisplayName"
        :style="[
          dayLayout.groupStyle(group, column),
          entranceStyle(group, column, dayLayout),
        ]"
        @select-lesson="(lesson, event) => emit('select-lesson', lesson, event)"
        @contextmenu-lesson="
          (lesson, event) => emit('contextmenu-lesson', lesson, event)
        "
        @add-lesson="onAddToGroup(group)"
      />

      <template v-if="isEditable">
        <button
          v-for="row in emptyRowsOf(day, dayLayout)"
          :key="`empty-${row.slot}`"
          type="button"
          class="min-h-13.5 border border-dashed border-ghost-border hover:border-action/50 hover:bg-action/5 rounded-md max-xs:rounded-lg transition-all flex items-center justify-center group cursor-pointer"
          :style="{ gridColumn: column, gridRow: row.gridRow }"
          @click.stop="emit('add-lesson', { day, slot: row.slot })"
        >
          <Plus
            class="text-on-ghost-muted group-hover:text-action transition-transform group-hover:scale-110"
            :size="20"
          />
        </button>
      </template>
    </template>
  </ScheduleGrid>
</template>
