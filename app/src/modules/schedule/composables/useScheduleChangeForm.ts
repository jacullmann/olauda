import { ref, computed, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import type { ScheduleSubDto } from '@/api/schema';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useScheduleDisplay } from './useScheduleDisplay';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import { findLessonSubject } from '@/modules/schedule/utils/lesson';
import { scheduleKeys } from '@/modules/schedule/utils/scheduleQueries';
import { subjectsQuery } from '@/modules/courses/utils/courseQueries';
import { courseOptionLabel } from '@/modules/courses/utils/subjectLabels';

type ScheduleChange = Omit<ScheduleSubDto, 'lessonId' | 'weekStart'>;

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
  const day = change.day ?? null;
  return {
    courseId: change.courseId ?? form.courseId,
    subject: change.subject ?? '',
    room: change.room ?? '',
    slot: change.slot ?? '',
    duration: change.duration ?? '',
    day: day === lesson.day ? null : day,
    cancelled: change.cancelled,
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
  const queryClient = useQueryClient();
  const groupId = useGroupPageId();
  const subjectsResult = useQuery(subjectsQuery(groupId));
  const subjects = computed(() => subjectsResult.data.value ?? []);
  const { days, schedulesCoursesIndividually, formatDayName, getDisplayName } =
    useScheduleDisplay();

  const form = ref(emptyChangeForm());
  const savedPayload = ref('');

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
  function changesPayload(): ScheduleChange {
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

  const reloadSchedule = () =>
    void queryClient.invalidateQueries({ queryKey: scheduleKeys.all(groupId) });

  const replaceChange = useMutation({
    mutationFn: (body: ScheduleSubDto) =>
      unwrap(
        api.PUT('/groups/{group_id}/admin/schedule/subs', {
          params: { path: { group_id: groupId } },
          body,
        }),
      ),
    onError: (err) =>
      toast.error(apiErrorMessage(err, t('schedule.errors.save_change'))),
    onSuccess: reloadSchedule,
  });

  const removeChange = useMutation({
    mutationFn: (change: Substitution) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/schedule/subs/{id}', {
          params: { path: { group_id: groupId, id: change.id } },
        }),
      ),
    onError: (err) =>
      toast.error(apiErrorMessage(err, t('schedule.errors.delete_change'))),
    onSuccess: reloadSchedule,
  });

  const saving = computed(
    () => replaceChange.isPending.value || removeChange.isPending.value,
  );

  /** Resolves to whether the change was saved; a failure was already told. */
  async function saveChange(): Promise<boolean> {
    const target = lesson.value;
    if (!target || !canSave.value || saving.value) return false;
    const change = existingChange.value;
    try {
      if (change && !changesLesson.value) {
        await removeChange.mutateAsync(change);
      } else {
        await replaceChange.mutateAsync({
          lessonId: target._originalId || target.id,
          weekStart: weekStart.value,
          ...changesPayload(),
        });
      }
      return true;
    } catch {
      return false;
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
