import { computed, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNow } from '@vueuse/core';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';
import type { Task } from '@/modules/tasks/types';
import {
  dueSectionKey,
  dueSectionOf,
  firstDayOfWeek,
  formatSectionMonth,
} from '@/modules/tasks/utils/dueSection';
import {
  taskListRows,
  type TaskSection,
} from '@/modules/tasks/utils/taskListRows';

const PINNED_SECTION_KEY = 'pinned';
const UNGROUPED_SECTION_KEY = 'ungrouped';
/** Often enough for the sections to move on shortly after midnight. */
const NOW_INTERVAL_MS = 60_000;

/**
 * The list's rows: the tasks under a heading for each section they are due
 * in, unless the member turned grouping off. Pinned tasks lead the list out of
 * date order, so they are a section of their own.
 */
export function useDueSections(
  items: Readonly<Ref<Task[]>>,
  isPinned: (id: string) => boolean,
) {
  const { t, locale } = useI18n();
  const now = useNow({ interval: NOW_INTERVAL_MS });
  const weekStart = computed(() => firstDayOfWeek(locale.value));
  const { settings } = usePageSettings('tasks');

  /** Ungrouped tasks only need a heading to set them apart from pinned ones. */
  function ungroupedSection(hasPinned: boolean): TaskSection {
    return {
      key: UNGROUPED_SECTION_KEY,
      label: hasPinned ? t('tasks.list.sections.unpinned') : null,
    };
  }

  function sectionOf(task: Task, hasPinned: boolean): TaskSection {
    if (isPinned(task.id)) {
      return {
        key: PINNED_SECTION_KEY,
        label: t('tasks.list.sections.pinned'),
      };
    }
    if (!settings.value.groupByDueDate) return ungroupedSection(hasPinned);
    const section = dueSectionOf(
      new Date(task.dueDate),
      now.value,
      weekStart.value,
    );
    return {
      key: dueSectionKey(section),
      label:
        section.kind === 'month'
          ? formatSectionMonth(section, locale.value, now.value)
          : t(`tasks.list.sections.${section.kind}`),
    };
  }

  const rows = computed(() => {
    const hasPinned = items.value.some((task) => isPinned(task.id));
    return taskListRows(items.value, (task) => sectionOf(task, hasPinned));
  });

  return { rows };
}
