import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type { Lesson } from '@/modules/schedule/types';
import { lessonDisplayName } from '@/modules/schedule/utils/lesson';
import { scheduleConfigOrDefault } from '@/modules/schedule/utils/slotTimes';
import { SCHOOL_DAYS, formatWeekday } from '@/modules/schedule/utils/weekday';

/** What every schedule view needs to lay out and label lessons, without loading any. */
export function useScheduleDisplay() {
  const i18n = useI18n();
  const { t, locale } = i18n;
  const te = i18n.te.bind(i18n);
  const { activeScheduleConfig, activeGroupType } = useGroups();

  // Abitur groups schedule each course on its own, so lessons carry a course.
  const schedulesCoursesIndividually = computed(
    () => activeGroupType.value === 'abitur',
  );

  const scheduleConfig = computed(() =>
    scheduleConfigOrDefault(activeScheduleConfig.value),
  );

  const formatDayName = (day: number, weekday: 'long' | 'short' = 'long') =>
    formatWeekday(day, locale.value, weekday);

  const getDisplayName = (lesson: Lesson): string =>
    lessonDisplayName(lesson, t, te);

  return {
    days: SCHOOL_DAYS,
    scheduleConfig,
    schedulesCoursesIndividually,
    formatDayName,
    getDisplayName,
  };
}
