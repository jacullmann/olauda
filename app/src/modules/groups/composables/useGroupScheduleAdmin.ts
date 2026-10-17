import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage, apiErrorStatus } from '@/api/errors';
import type { ScheduleConfigDto, ScheduleLessonDto } from '@/api/schema';
import { useToast } from '@/common/composables/useToast';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { useGroupPageId } from './useGroupPageId';
import { useSession } from '@/modules/auth/composables/useSession';
import type {
  Lesson,
  ScheduleBreaks,
  ScheduleConfig,
} from '@/modules/schedule/types';
import { isUuid } from '@/common/utils/uuid';
import { groupKeys } from '@/modules/groups/utils/groupQueries';
import { timetableQuery } from '@/modules/schedule/utils/scheduleQueries';

/** Answered while the API runs without the schedule editor. */
const METHOD_NOT_ALLOWED = 405;

function scheduleLessonPayload(lesson: Lesson): ScheduleLessonDto {
  const isDalton = lesson.isDalton === true;
  return {
    // Lessons drafted in the editor carry a temporary id the server never saw.
    ...(isUuid(lesson.id) ? { id: lesson.id } : {}),
    day: Number(lesson.day),
    slot: Number(lesson.slot),
    duration: Number(lesson.duration),
    room: lesson.room?.trim() || null,
    subjectId: isDalton ? null : (lesson.subjectId ?? null),
    courseId: isDalton ? null : (lesson.courseId ?? null),
    isDalton,
  };
}

function scheduleConfigPayload(config: ScheduleConfig): ScheduleConfigDto {
  const dayBreaks = Object.entries(config.dayBreaks).filter(
    (entry): entry is [string, ScheduleBreaks] => entry[1] !== undefined,
  );
  return { ...config, dayBreaks: Object.fromEntries(dayBreaks) };
}

/** The group's weekly schedule, as admins edit it. */
export function useGroupScheduleAdmin() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { checkAuthStatus } = useSession();

  const query = useQuery(timetableQuery(groupId));
  const lessons = computed<Lesson[]>(() => query.data.value?.lessons ?? []);

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('schedule.errors.load')),
  );

  const save = useMutation({
    mutationFn: (body: { lessons: Lesson[]; config: ScheduleConfig }) =>
      unwrap(
        api.PUT('/groups/{group_id}/admin/schedule', {
          params: { path: { group_id: groupId } },
          body: {
            lessons: body.lessons.map(scheduleLessonPayload),
            scheduleConfig: scheduleConfigPayload(body.config),
          },
        }),
      ),
    // The session's group list carries the layout of the school day.
    onSuccess: () =>
      Promise.all([
        checkAuthStatus(),
        queryClient.invalidateQueries({
          queryKey: groupKeys.topic(groupId, 'schedule'),
        }),
      ]),
  });

  async function saveScheduleBatch(
    updatedLessons: Lesson[],
    config: ScheduleConfig,
  ): Promise<boolean> {
    try {
      await save.mutateAsync({ lessons: updatedLessons, config });
      return true;
    } catch (error) {
      toast.error(
        apiErrorStatus(error) === METHOD_NOT_ALLOWED
          ? t('schedule.errors.save_unavailable')
          : apiErrorMessage(error, t('schedule.errors.save')),
      );
      return false;
    }
  }

  return {
    lessons,
    loadingLessons: query.isPending,
    savingScheduleConfig: save.isPending,
    saveScheduleBatch,
  };
}
