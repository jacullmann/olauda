import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api.ts';
import { groupPath } from '@/api/groupPath';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import type { AdminCourse, AdminSubject } from '@/modules/groups/types';
import type { CourseType } from '@/types/subjects';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/stores/modalStore';
import { useSubjectStore } from '@/stores/subjectStore';
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '@/api/errors';

const subjects = ref<AdminSubject[]>([]);
const loading = ref(false);
const saving = ref(false);

export function useSubjectAdmin() {
  const { t } = useI18n();
  const groupId = useGroupPageId();
  const confirmModal = useConfirmModal();
  const subjectStore = useSubjectStore();
  const { success, error: toastError } = useToast();

  const ERRORS = 'groups.settings.subjects.errors';

  /**
   * Server messages are English and meant for debugging, so failures are
   * explained with translated texts picked by the error's code and status.
   */
  function failureMessage(err: unknown, fallback: string): string {
    if (apiErrorCode(err) === 'NAME_TAKEN') return t(`${ERRORS}.name_taken`);
    return apiErrorMessage(err, t(`${ERRORS}.${fallback}`));
  }

  async function loadSubjects() {
    loading.value = true;
    try {
      const { data } = await api.get<AdminSubject[]>(
        groupPath(groupId, '/admin/subjects'),
      );
      subjects.value = data || [];
    } catch {
      try {
        const { data } = await api.get<AdminSubject[]>(
          groupPath(groupId, '/schedule/subjects'),
        );
        subjects.value = data || [];
      } catch {
        toastError(t('groups.settings.subjects.errors.load'));
      }
    } finally {
      loading.value = false;
    }
  }

  async function createSubject(
    name: string,
    category?: string,
    isDalton = false,
  ) {
    if (!name.trim()) return;
    saving.value = true;
    try {
      const { data } = await api.post<AdminSubject>(
        groupPath(groupId, '/admin/subjects'),
        {
          name: name.trim(),
          category,
          isDalton,
        },
      );
      subjects.value.push(data);
      subjects.value.sort((a, b) => a.name.localeCompare(b.name));
      subjectStore.reset();
      success(t('groups.settings.subjects.create_success'));
    } catch (e: unknown) {
      toastError(failureMessage(e, 'create'));
    } finally {
      saving.value = false;
    }
  }

  async function updateSubject(
    id: string,
    updates: { name?: string; category?: string; isDalton?: boolean },
  ): Promise<boolean> {
    saving.value = true;
    try {
      await api.patch(groupPath(groupId, `/admin/subjects/${id}`), updates);
      const subject = subjects.value.find((s) => s.id === id);
      const categoryChanged =
        updates.category !== undefined &&
        updates.category !== subject?.category;
      if (subject) {
        if (updates.name !== undefined) subject.name = updates.name.trim();
        if (updates.category !== undefined) subject.category = updates.category;
        if (updates.isDalton !== undefined) subject.isDalton = updates.isDalton;
      }
      // The task form offers subjects by their Dalton flag and name.
      subjectStore.reset();
      if (updates.name !== undefined) {
        subjects.value.sort((a, b) => a.name.localeCompare(b.name));
      }
      // A new category can rewrite the type of every course below the subject.
      if (categoryChanged) await loadSubjects();
      success(t('groups.settings.subjects.update_success'));
      return true;
    } catch (e: unknown) {
      toastError(failureMessage(e, 'update'));
      await loadSubjects();
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function deleteSubject(id: string): Promise<boolean> {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.subjects.delete_modal.title'),
      content: t('groups.settings.subjects.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });

    if (!isConfirmed) return false;
    try {
      await api.delete(groupPath(groupId, `/admin/subjects/${id}`));
      subjects.value = subjects.value.filter((s) => s.id !== id);
      subjectStore.reset();
      success(t('groups.settings.subjects.delete_success'));
      return true;
    } catch (e: unknown) {
      // The only rejection a member can cause is a subject still in use.
      toastError(
        apiErrorStatus(e) === 400
          ? t(`${ERRORS}.subject_in_use`)
          : apiErrorMessage(e, t(`${ERRORS}.delete`)),
      );
      return false;
    }
  }

  async function createCourse(
    subjectId: string,
    name: string,
    courseType?: CourseType | null,
  ): Promise<boolean> {
    if (!name.trim()) return false;
    saving.value = true;
    try {
      const { data } = await api.post<AdminCourse & { subjectId: string }>(
        groupPath(groupId, `/admin/subjects/${subjectId}/courses`),
        { name: name.trim(), courseType },
      );
      const subject = subjects.value.find((s) => s.id === subjectId);
      if (subject) {
        if (!subject.courses) subject.courses = [];
        // The server decides the final type: a Zusatzkurs subject overrides it.
        subject.courses.push({
          id: data.id,
          name: data.name,
          courseType: data.courseType,
        });
        subject.courses.sort((a, b) => a.name.localeCompare(b.name));
      }
      subjectStore.reset();
      success(t('groups.settings.subjects.course_create_success'));
      return true;
    } catch (e: unknown) {
      toastError(failureMessage(e, 'create_course'));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function updateCourse(
    subjectId: string,
    courseId: string,
    name: string,
    courseType?: CourseType | null,
  ): Promise<boolean> {
    if (!name.trim()) return false;
    saving.value = true;
    try {
      const { data } = await api.patch<{ courseType?: CourseType | null }>(
        groupPath(groupId, `/admin/courses/${courseId}`),
        { name: name.trim(), courseType },
      );
      const subject = subjects.value.find((s) => s.id === subjectId);
      if (subject && subject.courses) {
        const course = subject.courses.find((c) => c.id === courseId);
        if (course) {
          course.name = name.trim();
          course.courseType = data?.courseType ?? courseType;
        }
        subject.courses.sort((a, b) => a.name.localeCompare(b.name));
      }
      subjectStore.reset();
      success(t('groups.settings.subjects.course_update_success'));
      return true;
    } catch (e: unknown) {
      toastError(failureMessage(e, 'update_course'));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function deleteCourse(
    subjectId: string,
    courseId: string,
  ): Promise<boolean> {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.subjects.course_delete_modal.title'),
      content: t('groups.settings.subjects.course_delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });

    if (!isConfirmed) return false;
    saving.value = true;
    try {
      await api.delete(groupPath(groupId, `/admin/courses/${courseId}`));
      const subject = subjects.value.find((s) => s.id === subjectId);
      if (subject && subject.courses) {
        subject.courses = subject.courses.filter((c) => c.id !== courseId);
      }
      subjectStore.reset();
      success(t('groups.settings.subjects.course_delete_success'));
      return true;
    } catch (e: unknown) {
      toastError(failureMessage(e, 'delete_course'));
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    subjects,
    loading,
    saving,
    loadSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    createCourse,
    updateCourse,
    deleteCourse,
  };
}
