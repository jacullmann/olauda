import { ref, computed, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useSubjectAdmin } from '@/modules/groups/composables/useSubjectAdmin';
import { useScheduleDisplay } from './useScheduleDisplay';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import { findLessonSubject } from '@/modules/schedule/utils/lesson';
import { courseOptionLabel } from '@/modules/courses/utils/subjectLabels';

interface ScheduleChangePayload {
  lessonId: string;
  weekStart: string;
  courseId?: string;
  cancelled?: true;
  subject?: string;
  room?: string;
  slot?: number;
  duration?: number;
  day?: number;
}

// A cleared number input hands `v-model.number` back an empty string.
const emptyChangeForm = () => ({
  courseId: '',
  subject: '',
  room: '',
  slot: '' as number | '',
  duration: '' as number | '',
  day: null as number | null,
  cancelled: false,
});

type ChangeForm = ReturnType<typeof emptyChangeForm>;

/**
 * The form as the lesson's existing change fills it in. The lesson's own day
 * stands for "no change", just as the day picker treats it.
 */
function changeFormOf(lesson: Lesson, change: Substitution | null): ChangeForm {
  const form = { ...emptyChangeForm(), courseId: lesson.courseId ?? '' };
  if (!change) return form;
  const day = change.day == null ? null : Number(change.day);
  return {
    courseId: change.courseId ?? form.courseId,
    subject: change.subject ?? '',
    room: change.room ?? '',
    slot: change.slot ?? '',
    duration: change.duration ?? '',
    day: day === lesson.day ? null : day,
    cancelled: !!change.cancelled,
  };
}

/**
 * The change an admin enters for one lesson of the group's schedule in one
 * week. A lesson holds at most one change a week, so a lesson that already
 * has one opens with it filled in and saving replaces it.
 */
export function useScheduleChangeForm(
  lesson: Ref<Lesson | null>,
  existingChange: Ref<Substitution | null>,
  weekStart: Ref<string>,
) {
  const i18n = useI18n();
  const { t } = i18n;
  const te = i18n.te.bind(i18n);
  const toast = useToast();
  const groupId = useGroupPageId();
  const { subjects, loadSubjects } = useSubjectAdmin();
  const { days, schedulesCoursesIndividually, formatDayName, getDisplayName } =
    useScheduleDisplay();

  const form = ref(emptyChangeForm());
  const savedPayload = ref('');
  const saving = ref(false);

  // An Abitur group runs too many courses for one to be moved or given another
  // subject, so its changes only cancel a lesson or send it to another room.
  const canRescheduleLessons = computed(
    () => !schedulesCoursesIndividually.value,
  );

  // Only opening another lesson resets the form; the change reloading while
  // the modal is open must not wipe what is being typed.
  watch(
    lesson,
    (opened) => {
      if (!opened) return;
      form.value = changeFormOf(opened, existingChange.value);
      savedPayload.value = JSON.stringify(changesPayload());
      if (subjects.value.length === 0) void loadSubjects();
    },
    { immediate: true },
  );

  const lessonSubjectName = computed(() =>
    lesson.value
      ? getDisplayName(lesson.value) || t('common.selection.unknown')
      : '',
  );

  const lessonSubject = computed(() =>
    lesson.value ? findLessonSubject(lesson.value, subjects.value) : undefined,
  );

  // Only a lesson standing for every course of its subject can narrow the
  // change down to one of them.
  const courseOptions = computed(() =>
    lesson.value?.courseId
      ? []
      : [
          {
            label: t('groups.settings.schedule.changes.all_subject_courses'),
            value: '',
          },
          ...(lessonSubject.value?.courses ?? []).map((course) => ({
            label: courseOptionLabel(course, t, te),
            value: course.id,
          })),
        ],
  );

  // The lesson's own day stands for "no change", so picking it again sends none.
  const dayOptions = computed(() =>
    days.map((day) =>
      day === lesson.value?.day
        ? {
            label: `${t('groups.settings.schedule.changes.no_change')} (${formatDayName(day)})`,
            value: String(day),
          }
        : { label: formatDayName(day), value: String(day) },
    ),
  );

  const day = computed({
    get: () => String(form.value.day ?? lesson.value?.day ?? ''),
    set: (value: string) => {
      const picked = Number(value);
      form.value.day = picked === lesson.value?.day ? null : picked;
    },
  });

  const changesLesson = computed(() => {
    const { subject, room, slot, duration, day, cancelled } = form.value;
    return (
      !!subject.trim() ||
      !!room.trim() ||
      slot !== '' ||
      duration !== '' ||
      day !== null ||
      cancelled
    );
  });

  /*
   * Emptying a lesson's existing change takes it back, so saving is possible
   * whenever the form differs from what is stored, unless nothing is stored
   * and nothing would be.
   */
  const canSave = computed(
    () =>
      JSON.stringify(changesPayload()) !== savedPayload.value &&
      (changesLesson.value || !!existingChange.value),
  );

  /** What the folded-away fields hold stays out of a cancellation. */
  function changesPayload(): Omit<
    ScheduleChangePayload,
    'lessonId' | 'weekStart'
  > {
    const { courseId, cancelled, subject, room, slot, duration, day } =
      form.value;
    const course = courseId ? { courseId } : {};
    if (cancelled) return { ...course, cancelled: true };
    return {
      ...course,
      ...(subject.trim() ? { subject: subject.trim() } : {}),
      ...(room.trim() ? { room: room.trim() } : {}),
      ...(slot !== '' ? { slot } : {}),
      ...(duration !== '' ? { duration } : {}),
      ...(day !== null ? { day } : {}),
    };
  }

  async function replaceChange(target: Lesson): Promise<boolean> {
    const payload: ScheduleChangePayload = {
      lessonId: target._originalId || target.id,
      weekStart: weekStart.value,
      ...changesPayload(),
    };
    try {
      await api.put(groupPath(groupId, '/admin/schedule/subs'), payload);
      return true;
    } catch {
      toast.error(t('schedule.errors.save_change'));
      return false;
    }
  }

  async function removeChange(change: Substitution): Promise<boolean> {
    try {
      await api.delete(groupPath(groupId, `/admin/schedule/subs/${change.id}`));
      return true;
    } catch {
      toast.error(t('schedule.errors.delete_change'));
      return false;
    }
  }

  async function saveChange(): Promise<boolean> {
    const target = lesson.value;
    if (!target || !canSave.value || saving.value) return false;
    const change = existingChange.value;

    saving.value = true;
    try {
      return change && !changesLesson.value
        ? await removeChange(change)
        : await replaceChange(target);
    } finally {
      saving.value = false;
    }
  }

  return {
    form,
    saving,
    canRescheduleLessons,
    lessonSubjectName,
    courseOptions,
    dayOptions,
    day,
    canSave,
    saveChange,
  };
}
