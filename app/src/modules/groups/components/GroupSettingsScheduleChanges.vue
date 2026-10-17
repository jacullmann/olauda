<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, Trash2 } from '@lucide/vue';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useGroupScheduleChanges } from '@/modules/groups/composables/useGroupScheduleChanges';
import { useSubjectAdmin } from '@/modules/groups/composables/useSubjectAdmin';
import type { ScheduleSubstitution } from '@/modules/groups/types';
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';
import type { Lesson } from '@/modules/schedule/types';
import {
  findLessonSubject,
  lessonDisplayName,
} from '@/modules/schedule/utils/lesson';
import { addDays, parseIsoDate } from '@/modules/schedule/utils/weekday';
import {
  courseLabel,
  subjectLabel,
} from '@/modules/courses/utils/subjectLabels';

const props = defineProps<{
  /** The group's weekly schedule, which names the lesson each change is for. */
  lessons: readonly Lesson[];
}>();

const i18n = useI18n();
const { t, locale } = i18n;
const te = i18n.te.bind(i18n);

const { changes, loadingChanges, loadChanges, deleteChange } =
  useGroupScheduleChanges();
const { checkPermission } = useGroups();
const { subjects } = useSubjectAdmin();
const { formatDayName } = useScheduleDisplay();

const canManageScheduleChanges = computed(() =>
  checkPermission('manage_schedule_changes'),
);

const lessonsById = computed(
  () => new Map(props.lessons.map((lesson) => [lesson.id, lesson])),
);

function changedCourseName(courseId?: string | null): string {
  if (!courseId) return t('groups.settings.schedule.changes.all_courses');
  for (const subject of subjects.value) {
    const course = subject.courses?.find(({ id }) => id === courseId);
    if (course) return courseLabel(course.name, t, te);
  }
  return t('groups.settings.schedule.changes.specific_course');
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);

const lessonName = (lesson: Lesson) =>
  lessonDisplayName(
    {
      ...lesson,
      subjectName:
        lesson.subjectName ?? findLessonSubject(lesson, subjects.value)?.name,
    },
    t,
    te,
  ) || t('common.selection.unknown');

/** What the change does to its lesson, one entry per changed detail. */
function changeSummary(change: ScheduleSubstitution): string[] {
  if (change.cancelled) return [];
  const label = (key: string, value: string | number) =>
    `${t(`groups.settings.schedule.changes.${key}`)}: ${value}`;
  return [
    change.subject &&
      label('new_subject_label', subjectLabel(change.subject, t, te)),
    change.room && label('new_room_label', change.room),
    change.day && label('new_day_label', formatDayName(Number(change.day))),
    change.slot && label('new_slot_label', change.slot),
    change.duration && label('new_duration_label', change.duration),
  ].filter((detail): detail is string => !!detail);
}

/*
 * A change names its lesson by id and its week by the Monday, so each row
 * spells out the date the lesson falls on and which lesson it is. Past weeks
 * pile up, so the latest dates come first.
 */
const rows = computed(() =>
  changes.value
    .map((change) => {
      const lesson = lessonsById.value.get(change.lessonId);
      const date = addDays(
        parseIsoDate(change.weekStart),
        (lesson?.day ?? 1) - 1,
      );
      return {
        change,
        date,
        slot: lesson?.slot ?? 0,
        dateLabel: formatDate(date),
        lessonLabel: lesson
          ? `${lessonName(lesson)}, ${t('schedule.period', { slot: lesson.slot })}`
          : t('common.selection.unknown'),
        courseLabel: changedCourseName(change.courseId),
        summary: changeSummary(change),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.slot - b.slot),
);
</script>

<template>
  <div>
    <BasePageHeader>
      {{ t('groups.settings.schedule.changes.title') }}

      <template #action>
        <BaseTooltip :content="t('common.buttons.refresh')">
          <BaseButton
            :disabled="loadingChanges"
            variant="ghost"
            :icon="RefreshCw"
            @click="loadChanges"
          />
        </BaseTooltip>
      </template>
    </BasePageHeader>

    <div
      v-if="changes.length === 0 && !loadingChanges"
      class="text-center p-8 text-on-ghost-muted text-base"
    >
      {{ t('groups.settings.schedule.changes.no_changes') }}
    </div>
    <BaseTableWrapper v-else>
      <table>
        <thead>
          <tr>
            <th>{{ t('groups.settings.schedule.changes.table.date') }}</th>
            <th>{{ t('groups.settings.schedule.changes.table.lesson') }}</th>
            <th>{{ t('groups.settings.schedule.changes.table.course') }}</th>
            <th>{{ t('groups.settings.schedule.changes.table.change') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{
              change,
              dateLabel,
              lessonLabel,
              courseLabel: course,
              summary,
            } in rows"
            :key="change.id"
          >
            <td class="whitespace-nowrap">{{ dateLabel }}</td>
            <td>{{ lessonLabel }}</td>
            <td>{{ course }}</td>
            <td>
              <span v-if="change.cancelled" class="text-danger">
                {{ t('groups.settings.schedule.changes.cancelled_label') }}
              </span>
              <span v-else>{{ summary.join(', ') }}</span>
            </td>
            <td class="py-0! px-2! min-w-0!">
              <BaseTooltip
                :content="t('common.buttons.delete')"
                placement="bottom"
              >
                <BaseButton
                  :disabled="!canManageScheduleChanges"
                  variant="ghost"
                  size="sm"
                  :icon="Trash2"
                  @click="deleteChange(change.id)"
                />
              </BaseTooltip>
            </td>
          </tr>
        </tbody>
      </table>
    </BaseTableWrapper>
  </div>
</template>
