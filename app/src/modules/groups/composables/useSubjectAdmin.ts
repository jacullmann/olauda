import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type {
  CreateCourseDto,
  CreateSubjectDto,
  SubjectCategory,
  UpdateCourseDto,
  UpdateSubjectDto,
} from '@/api/schema';
import { useGroupPageId } from './useGroupPageId';
import { useGroups } from './useGroups';
import type { AdminSubject } from '@/modules/groups/types';
import type { CourseType } from '@/modules/courses/types';
import { useToast } from '@/common/composables/useToast';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import {
  groupAdminSubjectsQuery,
  groupKeys,
} from '@/modules/groups/utils/groupQueries';
import { subjectsQuery } from '@/modules/courses/utils/courseQueries';

const ERRORS = 'groups.settings.subjects.errors';
const BAD_REQUEST = 400;

/** The group's subjects and their courses, as its admins edit them. */
export function useSubjectAdmin() {
  const { t } = useI18n();
  const groupId = useGroupPageId();
  const confirmModal = useConfirmModal();
  const queryClient = useQueryClient();
  const { checkPermission } = useGroups();
  const { error: toastError } = useToast();

  // Both answer the same list; only editors may ask the admin endpoint.
  const editable = computed(() => checkPermission('edit_subjects_courses'));
  const adminSubjects = useQuery(
    computed(() => ({
      ...groupAdminSubjectsQuery(groupId),
      enabled: editable.value,
    })),
  );
  const memberSubjects = useQuery(
    computed(() => ({ ...subjectsQuery(groupId), enabled: !editable.value })),
  );
  const query = computed(() =>
    editable.value ? adminSubjects : memberSubjects,
  );
  const subjects = computed<AdminSubject[]>(() => query.value.data.value ?? []);

  const loadErrorMessage = (err: unknown) =>
    apiErrorMessage(err, t(`${ERRORS}.load`));
  useLoadErrorToast(adminSubjects, loadErrorMessage);
  useLoadErrorToast(memberSubjects, loadErrorMessage);

  /**
   * Server messages are English and meant for debugging, so failures are
   * explained with translated texts picked by the error's code.
   */
  function failureMessage(err: unknown, fallback: string): string {
    if (apiErrorCode(err) === 'NAME_TAKEN') return t(`${ERRORS}.name_taken`);
    return apiErrorMessage(err, t(`${ERRORS}.${fallback}`));
  }

  // Every edit carries this key, so `saving` covers whichever is running.
  const mutationKey = [...groupKeys.topic(groupId, 'subjects'), 'edit'];
  const runningEdits = useIsMutating({ mutationKey });
  const saving = computed(() => runningEdits.value > 0);

  // The task form and the schedule offer the subjects as well.
  const subjectsChanged = () =>
    queryClient.invalidateQueries({
      queryKey: groupKeys.topic(groupId, 'subjects'),
    });

  /** Whether an edit went through; a failure is reported with `errorText`. */
  function settle(
    edit: Promise<unknown>,
    errorText: (err: unknown) => string,
  ): Promise<boolean> {
    return edit.then(
      () => true,
      (err: unknown) => {
        toastError(errorText(err));
        return false;
      },
    );
  }

  const subjectCreation = useMutation({
    mutationKey,
    mutationFn: (body: CreateSubjectDto) =>
      unwrap(
        api.POST('/groups/{group_id}/admin/subjects', {
          params: { path: { group_id: groupId } },
          body,
        }),
      ),
    onSettled: subjectsChanged,
  });

  const subjectUpdate = useMutation({
    mutationKey,
    mutationFn: ({ id, body }: { id: string; body: UpdateSubjectDto }) =>
      unwrap(
        api.PATCH('/groups/{group_id}/admin/subjects/{id}', {
          params: { path: { group_id: groupId, id } },
          body,
        }),
      ),
    onSettled: subjectsChanged,
  });

  const subjectRemoval = useMutation({
    mutationKey,
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/subjects/{id}', {
          params: { path: { group_id: groupId, id } },
        }),
      ),
    onSettled: subjectsChanged,
  });

  const courseCreation = useMutation({
    mutationKey,
    mutationFn: ({
      subjectId,
      body,
    }: {
      subjectId: string;
      body: CreateCourseDto;
    }) =>
      unwrap(
        api.POST('/groups/{group_id}/admin/subjects/{subject_id}/courses', {
          params: { path: { group_id: groupId, subject_id: subjectId } },
          body,
        }),
      ),
    onSettled: subjectsChanged,
  });

  const courseUpdate = useMutation({
    mutationKey,
    mutationFn: ({ id, body }: { id: string; body: UpdateCourseDto }) =>
      unwrap(
        api.PATCH('/groups/{group_id}/admin/courses/{id}', {
          params: { path: { group_id: groupId, id } },
          body,
        }),
      ),
    onSettled: subjectsChanged,
  });

  const courseRemoval = useMutation({
    mutationKey,
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE('/groups/{group_id}/admin/courses/{id}', {
          params: { path: { group_id: groupId, id } },
        }),
      ),
    onSettled: subjectsChanged,
  });

  function createSubject(
    name: string,
    category?: SubjectCategory,
    isDalton = false,
  ): Promise<boolean> {
    if (!name.trim()) return Promise.resolve(false);
    return settle(
      subjectCreation.mutateAsync({ name: name.trim(), category, isDalton }),
      (err) => failureMessage(err, 'create'),
    );
  }

  function updateSubject(id: string, updates: UpdateSubjectDto) {
    return settle(
      subjectUpdate.mutateAsync({
        id,
        body: { ...updates, name: updates.name?.trim() },
      }),
      (err) => failureMessage(err, 'update'),
    );
  }

  async function deleteSubject(id: string): Promise<boolean> {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.subjects.delete_modal.title'),
      content: t('groups.settings.subjects.delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!isConfirmed) return false;

    return settle(
      subjectRemoval.mutateAsync(id),
      // The only rejection a member can cause is a subject still in use.
      (err) =>
        apiErrorStatus(err) === BAD_REQUEST
          ? t(`${ERRORS}.subject_in_use`)
          : apiErrorMessage(err, t(`${ERRORS}.delete`)),
    );
  }

  function createCourse(
    subjectId: string,
    name: string,
    courseType?: CourseType | null,
  ): Promise<boolean> {
    if (!name.trim()) return Promise.resolve(false);
    return settle(
      courseCreation.mutateAsync({
        subjectId,
        body: { name: name.trim(), courseType },
      }),
      (err) => failureMessage(err, 'create_course'),
    );
  }

  function updateCourse(
    courseId: string,
    name: string,
    courseType?: CourseType | null,
  ): Promise<boolean> {
    if (!name.trim()) return Promise.resolve(false);
    return settle(
      courseUpdate.mutateAsync({
        id: courseId,
        body: { name: name.trim(), courseType },
      }),
      (err) => failureMessage(err, 'update_course'),
    );
  }

  async function deleteCourse(courseId: string): Promise<boolean> {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.subjects.course_delete_modal.title'),
      content: t('groups.settings.subjects.course_delete_modal.message'),
      submitText: t('common.buttons.delete'),
      danger: true,
    });
    if (!isConfirmed) return false;

    return settle(courseRemoval.mutateAsync(courseId), (err) =>
      failureMessage(err, 'delete_course'),
    );
  }

  return {
    subjects,
    loading: computed(() => query.value.isPending.value),
    saving,
    loadSubjects: () => void query.value.refetch(),
    createSubject,
    updateSubject,
    deleteSubject,
    createCourse,
    updateCourse,
    deleteCourse,
  };
}
