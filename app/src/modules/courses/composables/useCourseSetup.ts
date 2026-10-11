import { computed, ref, shallowRef, watch } from 'vue';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useSubjectStore } from '@/modules/courses/stores/useSubjectStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import type { Enrollment } from './useCourseSelection';
import type { Lesson } from '@/modules/schedule/types';
import { scheduleConfigOrDefault } from '@/modules/schedule/utils/slotTimes';
import {
  courseLevelsOf,
  coursesAtLevel,
  defaultCourseLevel,
  type CourseLevel,
} from '@/modules/courses/utils/courseLevels';
import {
  createCourseResolver,
  type CourseCandidates,
  type CoursePicks,
} from '@/modules/courses/utils/courseResolution';
import { inScheduleOrder } from '@/modules/courses/utils/scheduleOrder';

/**
 * An Abitur member's first course choice: a level per subject first, then the
 * exact course wherever a level leaves more than one, picked in the timetable.
 */
export function useCourseSetup(groupId: string) {
  const subjectStore = useSubjectStore();
  const { findGroup } = useGroups();

  const subjects = computed(() => [
    ...subjectStore.requiredCourseSubjects,
    ...subjectStore.optionalCourseSubjects,
  ]);

  const levelOptions = computed(
    () =>
      new Map(
        subjects.value.map((subject) => [subject.id, courseLevelsOf(subject)]),
      ),
  );

  const levels = ref<Record<string, CourseLevel | null>>({});

  function resetLevels() {
    levels.value = Object.fromEntries(
      [...levelOptions.value].map(([subjectId, offered]) => [
        subjectId,
        defaultCourseLevel(offered),
      ]),
    );
  }

  watch(levelOptions, resetLevels, { immediate: true });

  /** A subject offering a single level has it settled without asking. */
  const levelChoiceSubjects = computed(() =>
    subjects.value.filter(
      (subject) => (levelOptions.value.get(subject.id)?.length ?? 0) > 1,
    ),
  );

  const hasAllLevels = computed(() =>
    subjects.value.every((subject) => levels.value[subject.id] != null),
  );

  const candidates = computed<CourseCandidates>(
    () =>
      new Map(
        subjects.value.flatMap((subject) => {
          const level = levels.value[subject.id];
          const courseIds = level
            ? coursesAtLevel(subject, level).map((course) => course.id)
            : [];
          return courseIds.length > 0 ? [[subject.id, courseIds]] : [];
        }),
      ),
  );

  /** Some level leaves more than one course, so the timetable has to tell. */
  const needsLessonChoice = computed(() =>
    [...candidates.value.values()].some((courseIds) => courseIds.length > 1),
  );

  const lessons = shallowRef<Lesson[]>([]);
  const loadingLessons = ref(false);
  let lessonsRequest: Promise<void> | null = null;

  /**
   * The whole timetable: the member's own one hides courses not yet taken.
   * Callers share one request, and a failed one can be retried.
   */
  function loadLessons(): Promise<void> {
    lessonsRequest ??= (async () => {
      loadingLessons.value = true;
      try {
        const { data } = await api.get<Lesson[]>(
          groupPath(groupId, '/admin/schedule'),
        );
        lessons.value = data ?? [];
      } catch (e) {
        lessonsRequest = null;
        throw e;
      } finally {
        loadingLessons.value = false;
      }
    })();
    return lessonsRequest;
  }

  const scheduleConfig = computed(() =>
    scheduleConfigOrDefault(findGroup(groupId)?.scheduleConfig),
  );

  const resolver = computed(() =>
    createCourseResolver(candidates.value, lessons.value),
  );
  const picks = shallowRef<CoursePicks>(new Map());
  const resolution = computed(() => resolver.value.resolve(picks.value));

  function toggleCourse(courseId: string) {
    picks.value = resolver.value.togglePick(
      resolution.value,
      picks.value,
      courseId,
    );
  }

  /** Starts the choice over from the default levels and no picks. */
  function reset() {
    resetLevels();
    picks.value = new Map();
  }

  const canToggleCourse = (courseId: string) =>
    resolver.value.isPickable(resolution.value, courseId);

  /*
   * Lessons of a subject nobody picks a course in concern everyone, and so do
   * course-less lessons of a subject the member takes. Course lessons show
   * only while the member could still attend that course.
   */
  const setupLessons = computed(() => {
    const courseSubjectIds = new Set(
      subjects.value.map((subject) => subject.id),
    );
    return lessons.value.filter((lesson) => {
      if (lesson.courseId && resolver.value.subjectOf.has(lesson.courseId)) {
        return true;
      }
      const subjectId = lesson.subjectId ?? lesson.subjects?.id;
      if (!subjectId || !courseSubjectIds.has(subjectId)) return true;
      return !lesson.courseId && candidates.value.has(subjectId);
    });
  });

  const enrollments = computed<Enrollment[]>(() =>
    [...resolution.value.chosen].map(([subjectId, courseId]) => ({
      subjectId,
      courseId,
    })),
  );

  /** Subjects the member takes whose course is still undecided. */
  const openSubjects = computed(() =>
    inScheduleOrder(
      subjects.value.filter(
        (subject) =>
          candidates.value.has(subject.id) &&
          !resolution.value.chosen.has(subject.id),
      ),
      candidates.value,
      resolution.value.states,
      lessons.value,
    ),
  );

  return {
    reset,
    subjects,
    levelOptions,
    levelChoiceSubjects,
    levels,
    hasAllLevels,
    needsLessonChoice,
    loadingLessons,
    loadLessons,
    scheduleConfig,
    setupLessons,
    resolution,
    toggleCourse,
    canToggleCourse,
    enrollments,
    openSubjects,
  };
}
