import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { queryClient } from '@/api/queryClient';
import type { CourseDto, SubjectDto } from '@/api/schema';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { courseSelectionFor } from '@/modules/courses/types';
import { subjectsQuery } from '@/modules/courses/utils/courseQueries';

export type Course = CourseDto;
export type Subject = SubjectDto;

/**
 * Subjects of one group at a time: the one on screen, or the one a task form
 * opened elsewhere targets.
 */
export const useSubjectStore = defineStore('subjectStore', () => {
  const { findGroup } = useGroups();

  const groupId = ref<string | null>(null);
  const query = useQuery(
    computed(() => ({
      ...subjectsQuery(groupId.value ?? ''),
      enabled: groupId.value !== null,
    })),
    queryClient,
  );

  const subjects = computed<Subject[]>(() => query.data.value ?? []);
  const loading = computed(() => query.isLoading.value);

  /** Resolves once the group's subjects are known, or failed to load. */
  async function loadSubjects(target: string): Promise<void> {
    groupId.value = target;
    await queryClient.fetchQuery(subjectsQuery(target)).catch(() => undefined);
  }

  /** Dalton tasks offer only Dalton subjects, unless the group marked none. */
  const daltonSubjects = computed(() => {
    const marked = subjects.value.filter((s) => s.isDalton);
    return marked.length > 0 ? marked : subjects.value;
  });

  const withCourses = (selection: 'required' | 'optional') =>
    subjects.value.filter(
      (s) =>
        courseSelectionFor(s.category) === selection && s.courses.length >= 1,
    );

  /** Subjects whose course a member has to pick. */
  const requiredCourseSubjects = computed(() => withCourses('required'));

  /** Subjects where a member picks one course or none — all Abitur subjects. */
  const optionalCourseSubjects = computed(() => withCourses('optional'));

  const groupType = computed(
    () => findGroup(groupId.value)?.groupType ?? 'regular',
  );

  return {
    groupId,
    subjects,
    loading,
    loadSubjects,
    daltonSubjects,
    groupType,
    requiredCourseSubjects,
    optionalCourseSubjects,
  };
});
