import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isAxiosError } from 'axios';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import type { Lesson, ScheduleConfig } from '@/modules/schedule/types';
import { isUuid } from '@/utils/uuid';

interface ScheduleLessonPayload {
  id?: string;
  day: number;
  slot: number;
  duration: number;
  room: string | null;
  subjectId: string | null;
  courseId: string | null;
  isDalton: boolean;
}

function scheduleLessonPayload(lesson: Lesson): ScheduleLessonPayload {
  const isDalton = lesson.isDalton === true;
  return {
    // Lessons drafted in the editor carry a temporary id the server never saw.
    ...(isUuid(lesson.id) ? { id: lesson.id } : {}),
    day: Number(lesson.day),
    slot: Number(lesson.slot),
    duration: Number(lesson.duration),
    room: lesson.room?.trim() || null,
    subjectId: isDalton
      ? null
      : (lesson.subjectId ?? lesson.subjects?.id ?? null),
    courseId: isDalton ? null : (lesson.courseId ?? lesson.courses?.id ?? null),
    isDalton,
  };
}

/** The group's weekly schedule, as admins edit it. */
export function useGroupScheduleAdmin() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const { checkAuthStatus, activeGroupDaltonEnabled } = useAppAuth();

  const lessons = ref<Lesson[]>([]);
  const loadingLessons = ref(false);
  const savingScheduleConfig = ref(false);

  async function loadSchedule() {
    loadingLessons.value = true;
    try {
      const { data } = await api.get<Lesson[]>(
        groupPath(groupId, '/admin/schedule'),
      );
      lessons.value = data;
    } catch {
      toast.error(t('schedule.errors.load'));
    } finally {
      loadingLessons.value = false;
    }
  }

  function scheduleSaveError(error: unknown): string {
    const fallback = t('schedule.errors.save');
    if (isAxiosError(error) && error.response?.status === 405) {
      return t('schedule.errors.save_unavailable');
    }
    return apiErrorMessage(error, fallback);
  }

  async function saveScheduleBatch(
    updatedLessons: Lesson[],
    config: ScheduleConfig,
  ): Promise<boolean> {
    savingScheduleConfig.value = true;
    try {
      await api.put(groupPath(groupId, '/admin/schedule'), {
        lessons: updatedLessons.map(scheduleLessonPayload),
        scheduleConfig: config,
      });
      await Promise.all([checkAuthStatus(), loadSchedule()]);
      return true;
    } catch (error) {
      toast.error(scheduleSaveError(error));
      return false;
    } finally {
      savingScheduleConfig.value = false;
    }
  }

  // Turning Dalton off deletes its lessons on the server, so the schedule
  // handed to the editor has to be fetched again.
  watch(activeGroupDaltonEnabled, () => void loadSchedule());

  onMounted(loadSchedule);

  return {
    lessons,
    loadingLessons,
    savingScheduleConfig,
    saveScheduleBatch,
  };
}
