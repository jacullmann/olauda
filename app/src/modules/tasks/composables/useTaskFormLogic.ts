import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useEventListener } from '@vueuse/core';
import api from '../../../api/api';
import { groupPath } from '@/api/groupPath';
import type { Task } from '@/modules/tasks/types';
import type {
  ItemSubjectPayload,
  ItemType,
  TaskFile,
} from '@/modules/tasks/types';
import { taskRoute } from '@/modules/tasks/utils/routes';
import { useImageUpload } from '@/modules/tasks/composables/useImageUpload';
import { useFileDrop } from '@/modules/tasks/composables/useFileDrop';
import { IMAGE_QUOTAS } from '@/modules/tasks/utils/imageQuota';
import { useTaskPermissions } from '@/modules/tasks/composables/useTaskPermissions';
import { useI18n } from 'vue-i18n';
import {
  CUSTOM_SUBJECT_MAX_LENGTH,
  subjectNeedsCourseChoice,
} from '@/types/subjects';
import { useSubjectStore, type Subject } from '@/stores/subjectStore';
import { useEnrolledCourses } from '@/common/composables/useEnrolledCourses';
import {
  builtInSubjectKey,
  courseLabel,
  courseTypeHint,
  formatSubjectDisplay,
  subjectLabel,
} from '@/utils/subject-formatter';
import { apiErrorMessage } from '@/api/errors';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import { useConfirmModal } from '@/stores/modalStore';

export const OTHER_SUBJECT = '__OTHER__';
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MAX_LENGTH = 1000;

export function useTaskFormLogic(
  initialGroupId: string,
  initial: Task | null | undefined,
  initialType: Exclude<ItemType, 'all'> | undefined,
  emit: {
    (e: 'cancel'): void;
    (e: 'success'): void;
  },
) {
  const i18n = useI18n();
  const router = useRouter();
  const t = (key: string, named?: Record<string, any>) =>
    i18n.t(key, named || {});
  const te = (key: string) => i18n.te(key);

  const subjectStore = useSubjectStore();
  const { enrolledCourseForSubjectId } = useEnrolledCourses();
  const { findGroup, activeGroupId, userGroups } = useAppAuth();
  const groupId = ref(initialGroupId);
  const targetGroup = computed(() => findGroup(groupId.value));
  const daltonEnabled = computed(
    () => targetGroup.value?.daltonEnabled === true,
  );
  /** Only worth showing when the user could mean more than one group. */
  const canChooseGroup = computed(() => userGroups.value.length > 1);

  const typeTabItems = computed(() => [
    { id: 'homework', label: t('tasks.list.types.homework') },
    ...(daltonEnabled.value
      ? [{ id: 'dalton', label: t('tasks.list.types.dalton') }]
      : []),
    { id: 'exam', label: t('tasks.list.types.exam') },
  ]);

  const requestedType = initialType ?? 'homework';
  const activeType = ref<Exclude<ItemType, 'all'>>(
    initial
      ? initial.type
      : requestedType === 'dalton' && !daltonEnabled.value
        ? 'homework'
        : requestedType,
  );

  watch(daltonEnabled, (enabled) => {
    if (!enabled && activeType.value === 'dalton')
      activeType.value = 'homework';
  });

  const {
    images: imgImages,
    uploading: imgUploading,
    uploadError: imgUploadError,
    init: imgInit,
    uploadImage,
    removeImg,
    uploadFiles,
  } = useImageUpload(groupId);

  const { canUploadImages, canDeleteImage } = useTaskPermissions(groupId);

  /** Images of a new task are only local until it is created. */
  const canRemoveImage = (file: TaskFile) =>
    !initial || ('createdBy' in file && canDeleteImage(initial, file));

  const pickImages = () => uploadImage(activeType.value, initial?.id);

  /** Switching a new task to a type with a smaller quota can leave too many images. */
  const imageQuotaError = computed(() => {
    if (initial) return '';
    const max = IMAGE_QUOTAS[activeType.value].perUploader;
    return imgImages.value.length > max
      ? t('tasks.images.errors.type_quota_exceeded', { max })
      : '';
  });

  // uploadFiles filters unsupported types and enforces the size and quota limits.
  const { isDragOver: isDragging, handlers: dropHandlers } = useFileDrop(
    (files) => void uploadFiles(files, activeType.value, initial?.id),
    { enabled: canUploadImages },
  );

  const title = ref(initial?.title || '');
  /** A subject id, or {@link OTHER_SUBJECT} for a name typed in by hand. */
  const subjectSel = ref(initial ? (initial.subjectId ?? OTHER_SUBJECT) : '');
  const initialSubjectOther =
    initial && !initial.subjectId ? initial.subjectName : '';
  const subjectOther = ref(initialSubjectOther);
  const description = ref(initial?.description || '');
  const courseSel = ref(initial?.courseId ?? '');

  const titleError = ref('');
  const subjectError = ref('');
  const courseError = ref('');
  const subjectOtherError = ref('');
  const descriptionError = ref('');
  const dueDateError = ref('');

  const showDoubleTaskConfirm = ref(false);
  const doubleTaskOriginalItem = ref<Task | null>(null);
  const doubleCheckPassed = ref(false);

  const getSubjectName = (item: Pick<Task, 'subjectName' | 'courseName'>) =>
    formatSubjectDisplay(item.subjectName, item.courseName, t, te);

  const getTypeLabel = (type: string) => {
    if (type === 'homework') return t('tasks.list.types.homework');
    if (type === 'dalton') return t('tasks.list.types.dalton');
    if (type === 'exam') return t('tasks.list.types.exam');
    return type;
  };

  const formattedDueDate = computed(() => {
    try {
      if (!dueLocal.value) return '';
      return new Date(dueLocal.value).toLocaleDateString();
    } catch {
      return dueLocal.value;
    }
  });

  const doubleTaskSubjectName = computed(() => {
    if (!doubleTaskOriginalItem.value) return '';
    return getSubjectName(doubleTaskOriginalItem.value);
  });

  const doubleTaskConfirmMessage = computed(() => {
    if (!doubleTaskOriginalItem.value) return '';
    return t('tasks.list.double_task_confirm.message', {
      date: formattedDueDate.value,
      type: getTypeLabel(activeType.value),
      subject: doubleTaskSubjectName.value,
    });
  });

  const enrolledCourseId = (subjectId: string) =>
    enrolledCourseForSubjectId(subjectId)?.id ?? '';

  watch(subjectSel, (subjectId) => {
    courseSel.value = enrolledCourseId(subjectId);
  });

  // Subjects can still be loading while the form is open, so the preselection
  // is retried once they arrive - without overwriting an existing choice.
  watch(
    () => subjectStore.subjects,
    () => {
      if (!courseSel.value) {
        courseSel.value = enrolledCourseId(subjectSel.value);
      }
    },
  );

  const now = new Date();
  const minDate = new Date();
  minDate.setDate(now.getDate() - 2);
  minDate.setHours(0, 0, 0, 0);

  const maxDate = new Date();
  maxDate.setDate(now.getDate() + 365);
  maxDate.setHours(23, 59, 59, 999);

  function isoDateOnlyFromIso(iso: string) {
    try {
      const d = new Date(iso);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  const initialDueKey = initial ? isoDateOnlyFromIso(initial.dueDate) : null;
  const dueLocal = ref(initialDueKey ?? isoDateOnlyFromIso(now.toISOString()));
  const dueDateUnchanged = computed(() => dueLocal.value === initialDueKey);
  const minDateKey = isoDateOnlyFromIso(minDate.toISOString());
  const maxDateKey = isoDateOnlyFromIso(maxDate.toISOString());

  watch(
    [groupId, activeType, subjectSel, subjectOther, courseSel, dueLocal],
    () => {
      doubleCheckPassed.value = false;
    },
  );

  const submitting = ref(false);
  const submitError = ref('');

  const selectableSubjects = computed(() =>
    activeType.value === 'dalton'
      ? subjectStore.daltonSubjects
      : subjectStore.subjects,
  );

  // A subject picked for another type may not be offered for Dalton tasks.
  watch(activeType, () => {
    const current = subjectSel.value;
    if (
      current &&
      current !== OTHER_SUBJECT &&
      !selectableSubjects.value.some((s) => s.id === current)
    ) {
      subjectSel.value = '';
    }
  });

  const subjectOptions = computed(() => [
    ...selectableSubjects.value.map((s) => ({
      label: subjectLabel(s.name, t, te),
      value: s.id,
    })),
    { label: t('common.selection.other'), value: OTHER_SUBJECT },
  ]);

  const selectedSubject = computed(() =>
    subjectStore.subjects.find((s) => s.id === subjectSel.value),
  );

  const selectedSubjectHasCourses = computed(() => {
    const subject = selectedSubject.value;
    if (!subject?.courses) return false;
    return subjectNeedsCourseChoice(subject.category, subject.courses.length);
  });

  const courseOptions = computed(() =>
    (selectedSubject.value?.courses ?? []).map((c) => ({
      label: courseLabel(c.name, t, te),
      value: c.id,
      hint: courseTypeHint(c.courseType, t, te),
    })),
  );

  /**
   * A typed name the group offers after all, in any language or spelling,
   * becomes that subject instead of a detached label.
   */
  function groupSubjectForTypedName(typed: string): Subject | undefined {
    const lower = typed.toLowerCase();
    const builtInKey = builtInSubjectKey(typed);
    return subjectStore.subjects.find(
      (s) =>
        s.name.toLowerCase() === lower ||
        s.name === builtInKey ||
        subjectLabel(s.name, t, te).toLowerCase() === lower,
    );
  }

  async function submit() {
    submitting.value = true;
    submitError.value = '';

    titleError.value = '';
    subjectError.value = '';
    courseError.value = '';
    subjectOtherError.value = '';
    descriptionError.value = '';
    dueDateError.value = '';

    let hasValidationErrors = false;
    let subject: ItemSubjectPayload | null = null;

    if (!subjectSel.value) {
      subjectError.value = t(
        'tasks.list.task_form.errors.custom_subject_missing',
      );
      hasValidationErrors = true;
    } else if (subjectSel.value === OTHER_SUBJECT) {
      const typed = subjectOther.value.trim();
      const offered = typed ? groupSubjectForTypedName(typed) : undefined;
      if (!typed) {
        subjectOtherError.value = t(
          'tasks.list.task_form.errors.custom_subject_missing',
        );
        hasValidationErrors = true;
      } else if (typed.length > CUSTOM_SUBJECT_MAX_LENGTH) {
        subjectOtherError.value = t(
          'tasks.list.task_form.errors.custom_subject_too_long',
          {
            max: CUSTOM_SUBJECT_MAX_LENGTH,
          },
        );
        hasValidationErrors = true;
      } else if (offered) {
        subject = { subjectId: offered.id, courseId: null };
      } else {
        subject = { customName: typed };
      }
    } else if (selectedSubjectHasCourses.value && !courseSel.value) {
      courseError.value = t('tasks.list.task_form.errors.course_missing', {
        course: subjectLabel(selectedSubject.value?.name ?? '', t, te),
      });
      hasValidationErrors = true;
    } else {
      subject = {
        subjectId: subjectSel.value,
        courseId: selectedSubjectHasCourses.value ? courseSel.value : null,
      };
    }

    const cleanTitle = title.value.trim();
    if (!cleanTitle) {
      titleError.value = t('tasks.errors.title_missing');
      hasValidationErrors = true;
    } else if (cleanTitle.length > TITLE_MAX_LENGTH) {
      titleError.value = t('tasks.errors.title_too_long', {
        max: TITLE_MAX_LENGTH,
      });
      hasValidationErrors = true;
    }

    const cleanDesc = description.value.trim();
    if (cleanDesc.length > DESCRIPTION_MAX_LENGTH) {
      descriptionError.value = t('tasks.errors.description_too_long', {
        max: DESCRIPTION_MAX_LENGTH,
      });
      hasValidationErrors = true;
    }

    if (imageQuotaError.value) hasValidationErrors = true;

    const selectedDate = new Date(dueLocal.value);
    selectedDate.setHours(23, 59, 0, 0);

    // Old tasks stay editable: the allowed range only applies to a new date.
    if (!dueDateUnchanged.value) {
      if (selectedDate < minDate) {
        dueDateError.value = t(
          'tasks.list.task_form.errors.due_date_too_early',
        );
        hasValidationErrors = true;
      } else if (selectedDate > maxDate) {
        dueDateError.value = t('tasks.list.task_form.errors.due_date_too_late');
        hasValidationErrors = true;
      }
    }

    if (hasValidationErrors || !subject) {
      submitting.value = false;
      return;
    }

    try {
      const payload = {
        title: cleanTitle,
        subject,
        description: cleanDesc,
      };
      const dueDate = selectedDate.toISOString();

      if (initial) {
        await api.patch(groupPath(groupId.value, `/items/${initial.id}`), {
          ...payload,
          ...(dueDateUnchanged.value ? {} : { dueDate }),
        });
      } else {
        await api.post(groupPath(groupId.value, '/items'), {
          ...payload,
          dueDate,
          type: activeType.value,
          // An existing task's files are changed through their own endpoints.
          attachmentIds: imgImages.value.map((file) => file.id),
          confirmDoubleTask: doubleCheckPassed.value,
        });
      }

      emit('success');
    } catch (e: unknown) {
      const err = e as {
        response?: {
          status?: number;
          data?: { code?: string; item?: Task };
        };
      };

      if (
        err.response?.status === 409 &&
        err.response?.data?.code === 'DUPLICATE_ITEM'
      ) {
        doubleTaskOriginalItem.value = err.response.data.item || null;
        showDoubleTaskConfirm.value = true;
        submitting.value = false;
        return;
      }
      submitError.value = apiErrorMessage(e, t('tasks.errors.save'));
    } finally {
      submitting.value = false;
    }
  }

  async function confirmDoubleTaskSubmit() {
    doubleCheckPassed.value = true;
    showDoubleTaskConfirm.value = false;
    await submit();
  }

  function viewExisting() {
    if (!doubleTaskOriginalItem.value) return;
    showDoubleTaskConfirm.value = false;
    emit('cancel');
    void router.push(taskRoute(groupId.value, doubleTaskOriginalItem.value.id));
  }

  /** What would be lost on closing: typed text, and a new task's images. */
  const hasUnsavedInput = computed(
    () =>
      title.value !== (initial?.title || '') ||
      description.value !== (initial?.description || '') ||
      subjectOther.value !== initialSubjectOther ||
      (!initial && imgImages.value.length > 0),
  );

  const confirmModal = useConfirmModal();
  // Escape reaches the form and its dialog alike, and the dialog answering it
  // must not have the form ask again right away.
  let askingToDiscard = false;

  async function requestCancel() {
    if (askingToDiscard) return;
    if (hasUnsavedInput.value) {
      askingToDiscard = true;
      const discard = await confirmModal.ask({
        title: t('common.discard_changes.title'),
        content: t('common.discard_changes.content'),
        submitText: t('common.discard_changes.confirm'),
        danger: true,
      });
      askingToDiscard = false;
      if (!discard) return;
    }
    emit('cancel');
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showDoubleTaskConfirm.value) {
        showDoubleTaskConfirm.value = false;
      } else {
        void requestCancel();
      }
    }
  }

  const titleInputRef = ref<any>(null);

  useEventListener(window, 'keydown', onKeyDown);

  // Subjects belong to one group, so choosing another one swaps the whole list.
  watch(groupId, (id) => {
    if (subjectSel.value !== OTHER_SUBJECT) subjectSel.value = '';
    courseSel.value = '';
    void subjectStore.loadSubjects(id);
  });

  // The subject store follows the page, which the form must not leave behind.
  onBeforeUnmount(() => {
    if (activeGroupId.value && groupId.value !== activeGroupId.value) {
      void subjectStore.loadSubjects(activeGroupId.value);
    }
  });

  onMounted(() => {
    void subjectStore.loadSubjects(groupId.value);
    imgInit(initial?.attachments ?? []);
    titleInputRef.value?.focus();
  });

  return {
    requestCancel,
    t,
    groupId,
    canChooseGroup,
    targetGroup,
    typeTabItems,
    activeType,
    imgImages,
    imgUploading,
    imgUploadError,
    imageQuotaError,
    pickImages,
    removeImg,
    isDragging,
    dropHandlers,
    canUploadImages,
    canRemoveImage,
    title,
    subjectSel,
    subjectOther,
    description,
    courseSel,
    titleError,
    subjectError,
    courseError,
    subjectOtherError,
    descriptionError,
    dueDateError,
    dueLocal,
    minDateKey,
    maxDateKey,
    submitting,
    submitError,
    subjectOptions,
    selectedSubjectHasCourses,
    courseOptions,
    submit,
    titleInputRef,
    showDoubleTaskConfirm,
    doubleTaskOriginalItem,
    confirmDoubleTaskSubmit,
    viewExisting,
    getSubjectName,
    getTypeLabel,
    doubleTaskConfirmMessage,
  };
}
