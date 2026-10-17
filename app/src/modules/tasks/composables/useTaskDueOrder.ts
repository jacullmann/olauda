import { computed, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import type { SubstitutionDto } from '@/api/schema';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import {
  scheduleQuery,
  substitutionsQuery,
} from '@/modules/schedule/utils/scheduleQueries';
import type { Task } from '@/modules/tasks/types';
import { dueWeekRange, inDueOrder } from '@/modules/tasks/utils/dueLesson';

function byWeek(
  substitutions: readonly SubstitutionDto[],
): Map<string, SubstitutionDto[]> {
  const weeks = new Map<string, SubstitutionDto[]>();
  for (const substitution of substitutions) {
    const week = weeks.get(substitution.weekStart) ?? [];
    week.push(substitution);
    weeks.set(substitution.weekStart, week);
  }
  return weeks;
}

/**
 * The tasks with those due the same day in the order they are likely due in,
 * going by the group's schedule. Until the schedule is loaded, or when it
 * cannot be, they keep the order they came in.
 */
export function useTaskDueOrder(
  groupId: string,
  items: Readonly<Ref<Task[]>>,
  personalized: Readonly<Ref<boolean>>,
) {
  const { user } = storeToRefs(useUserStore());
  const { findGroup } = useGroups();

  const schedule = useQuery(scheduleQuery(groupId));

  const weekRange = computed(() => dueWeekRange(items.value));
  const substitutions = useQuery(
    computed(() => ({
      ...substitutionsQuery(groupId, weekRange.value ?? { from: '', to: '' }),
      enabled: !!weekRange.value,
      // The order stays put while the changes of other weeks load.
      placeholderData: keepPreviousData,
      select: byWeek,
    })),
  );

  // Shown all courses, a member who picked theirs finds them before the
  // others' wherever the schedule leaves two tasks tied.
  const ownCoursesFirst = computed(
    () => !personalized.value && findGroup(groupId)?.courseSetup === 'done',
  );

  const orderedItems = computed(() =>
    inDueOrder(
      items.value,
      {
        lessons: schedule.data.value?.lessons ?? [],
        substitutionsOfWeek: (weekStart) =>
          substitutions.data.value?.get(weekStart) ?? [],
        courses: user.value?.courses ?? [],
      },
      { ownCoursesFirst: ownCoursesFirst.value },
    ),
  );

  return { orderedItems };
}
