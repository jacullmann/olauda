import { computed, onMounted, shallowRef, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import type { Task } from '@/modules/tasks/types';
import { dueWeekRange, inDueOrder } from '@/modules/tasks/utils/dueLesson';

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

  const lessons = shallowRef<Lesson[]>([]);
  const substitutionsByWeek = shallowRef(new Map<string, Substitution[]>());
  let loadedWeekRange: string | null = null;
  let latestLessonsLoad = 0;
  let latestSubstitutionsLoad = 0;

  // The server leaves out the lessons of other courses once the member chose
  // to see only their own, so the schedule is loaded again when they switch.
  async function loadLessons() {
    const load = ++latestLessonsLoad;
    try {
      const { data } = await api.get<Lesson[]>(groupPath(groupId, '/schedule'));
      if (load === latestLessonsLoad) lessons.value = data;
    } catch (e) {
      console.error('Failed to load the schedule for the task order:', e);
    }
  }

  const weekRange = computed(() => dueWeekRange(items.value));
  const weekRangeKey = computed(() =>
    weekRange.value ? `${weekRange.value.from}/${weekRange.value.to}` : null,
  );

  async function loadSubstitutions() {
    const range = weekRange.value;
    const rangeKey = weekRangeKey.value;
    if (!range || rangeKey === loadedWeekRange) return;
    const load = ++latestSubstitutionsLoad;
    try {
      const { data } = await api.get<Substitution[]>(
        groupPath(groupId, '/schedule/subs'),
        { params: range },
      );
      if (load !== latestSubstitutionsLoad) return;
      const byWeek = new Map<string, Substitution[]>();
      for (const substitution of data) {
        const weekSubstitutions = byWeek.get(substitution.weekStart) ?? [];
        weekSubstitutions.push(substitution);
        byWeek.set(substitution.weekStart, weekSubstitutions);
      }
      substitutionsByWeek.value = byWeek;
      loadedWeekRange = rangeKey;
    } catch (e) {
      console.error('Failed to load schedule changes for the task order:', e);
    }
  }

  // Shown all courses, a member who picked theirs finds them before the
  // others' wherever the schedule leaves two tasks tied.
  const ownCoursesFirst = computed(
    () => !personalized.value && findGroup(groupId)?.courseSetup === 'done',
  );

  const orderedItems = computed(() =>
    inDueOrder(
      items.value,
      {
        lessons: lessons.value,
        substitutionsOfWeek: (weekStart) =>
          substitutionsByWeek.value.get(weekStart) ?? [],
        courses: user.value?.courses ?? [],
      },
      { ownCoursesFirst: ownCoursesFirst.value },
    ),
  );

  watch(personalized, () => void loadLessons());
  watch(weekRangeKey, () => void loadSubstitutions());

  onMounted(() => {
    void loadLessons();
    void loadSubstitutions();
  });

  return { orderedItems };
}
