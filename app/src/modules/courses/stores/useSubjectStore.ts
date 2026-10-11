import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useGroups } from '@/modules/groups/composables/useGroups';
import {
  courseSelectionFor,
  type CourseType,
  type SubjectCategory,
} from '@/modules/courses/types';

export interface Course {
  id: string;
  name: string;
  /** GK/LK/ZK in an Abitur group, absent everywhere else. */
  courseType?: CourseType | null;
}

export interface Subject {
  id: string;
  name: string;
  category: SubjectCategory;
  /** Offered for Dalton tasks; always set on the whole subject. */
  isDalton?: boolean;
  courses?: Course[];
}

/**
 * Subjects of one group at a time: the one on screen, or the one a task form
 * opened elsewhere targets. Loading another group replaces the list.
 */
export const useSubjectStore = defineStore('subjectStore', () => {
  const { findGroup } = useGroups();

  const groupId = ref<string | null>(null);
  const subjects = ref<Subject[]>([]);
  const loading = ref(false);
  const loaded = ref(false);

  async function loadSubjects(target: string) {
    if (groupId.value === target && (loaded.value || loading.value)) return;

    groupId.value = target;
    subjects.value = [];
    loaded.value = false;
    loading.value = true;
    try {
      const { data } = await api.get<Subject[]>(
        groupPath(target, '/schedule/subjects'),
      );
      // A newer load for another group wins over this late response.
      if (groupId.value !== target) return;
      subjects.value = data || [];
      loaded.value = true;
    } catch (e) {
      console.error('Failed to load subjects', e);
    } finally {
      if (groupId.value === target) loading.value = false;
    }
  }

  function reset() {
    groupId.value = null;
    subjects.value = [];
    loaded.value = false;
    loading.value = false;
  }

  /** Dalton tasks offer only Dalton subjects, unless the group marked none. */
  const daltonSubjects = computed(() => {
    const marked = subjects.value.filter((s) => s.isDalton);
    return marked.length > 0 ? marked : subjects.value;
  });

  const withCourses = (selection: 'required' | 'optional') =>
    subjects.value.filter(
      (s) =>
        courseSelectionFor(s.category) === selection &&
        (s.courses?.length ?? 0) >= 1,
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
    loaded,
    loadSubjects,
    reset,
    daltonSubjects,
    groupType,
    requiredCourseSubjects,
    optionalCourseSubjects,
  };
});
