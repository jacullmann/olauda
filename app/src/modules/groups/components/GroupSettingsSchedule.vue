<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Library,
  Undo2,
  Redo2,
} from '@lucide/vue';
import GroupSettingsScheduleEditor from './GroupSettingsScheduleEditor.vue';
import GroupSettingsScheduleConfig from './GroupSettingsScheduleConfig.vue';
import GroupSettingsScheduleChanges from './GroupSettingsScheduleChanges.vue';
import type { Lesson, ScheduleConfig } from '@/modules/schedule/types';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useSubjectAdmin } from '@/modules/groups/composables/useSubjectAdmin';
import { useGroupScheduleAdmin } from '@/modules/groups/composables/useGroupScheduleAdmin';
import { useLessonSelection } from '@/modules/groups/composables/useLessonSelection';
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import {
  cloneFnJSON,
  useEventListener,
  useManualRefHistory,
  useWindowSize,
} from '@vueuse/core';
import { useIsMobileViewport } from '@/common/composables/useViewport';
import { useLeaveGuard } from '@/common/composables/useLeaveGuard';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import {
  findLessonSubject,
  lessonLastSlot,
} from '@/modules/schedule/utils/lesson';
import {
  formatMinuteRange,
  slotRangeMinutes,
} from '@/modules/schedule/utils/slotTimes';
import { DALTON_SUBJECT_KEY } from '@/modules/courses/types';
import {
  courseOptionLabel,
  subjectLabel,
} from '@/modules/courses/utils/subjectLabels';

const i18n = useI18n();
const { t, locale } = i18n;
const te = i18n.te.bind(i18n);
const { width: windowWidth } = useWindowSize();
const isMobile = useIsMobileViewport();
const router = useRouter();
const groupId = useGroupPageId();

const { lessons, loadingLessons, savingScheduleConfig, saveScheduleBatch } =
  useGroupScheduleAdmin();

const { activeGroupDaltonEnabled, checkPermission } = useGroups();
const { subjects } = useSubjectAdmin();
const { scheduleConfig, schedulesCoursesIndividually, formatDayName } =
  useScheduleDisplay();

const canEditScheduleConfig = computed(() => checkPermission('edit_schedule'));
const TOOLBAR_TRANSITION_MS = 300;
const MAX_UNDO_STEPS = 50;

let draftSequence = 0;
// Never a UUID, so the server stores a draft lesson as a new one.
const draftId = (prefix: string) => `${prefix}_${++draftSequence}`;

// ----------------------------------------------------
// Editor Mode & Draft Transaction State
// ----------------------------------------------------
const isEditMode = ref(false);
const showToolbar = ref(false);
const draftLessons = ref<Lesson[]>([]);
const hasSwitchedFromEditor = ref(false);
const mobileMenuOpen = ref(false);

const {
  selectedLessonIds,
  singleSelectedLesson,
  deselectAll,
  selectOnly,
  selectByClick,
  selectDay,
} = useLessonSelection(draftLessons);

const selectedDraftLessonIds = computed(() => new Set(selectedLessonIds.value));

function clearSelection() {
  deselectAll();
  mobileMenuOpen.value = false;
}

const draftHistory = useManualRefHistory(draftLessons, {
  clone: true,
  capacity: MAX_UNDO_STEPS,
  // The selection can name lessons the restored draft no longer has.
  setSource: (source, lessons) => {
    source.value = lessons;
    clearSelection();
  },
});
const { canUndo, canRedo, undo, redo } = draftHistory;

function enterEditMode() {
  if (!canEditScheduleConfig.value) return;
  hasSwitchedFromEditor.value = true;
  draftLessons.value = cloneFnJSON(lessons.value);
  clearSelection();
  draftHistory.commit();
  draftHistory.clear();
  showToolbar.value = false;
  isEditMode.value = true;
  void nextTick(() => {
    requestAnimationFrame(() => {
      showToolbar.value = true;
    });
  });
}

/** Lets the toolbar fold away before the editor gives way to the substitutions. */
function leaveEditMode() {
  draftHistory.clear();
  showToolbar.value = false;
  setTimeout(() => {
    isEditMode.value = false;
    draftLessons.value = [];
    clearSelection();
  }, TOOLBAR_TRANSITION_MS);
}

/** Every change to the draft is a step in its history, and undone ones are no loss. */
const hasUnsavedDraft = computed(() => isEditMode.value && canUndo.value);

const confirmModal = useConfirmModal();
const confirmDiscardDraft = () =>
  confirmModal.ask({
    title: t('common.discard_changes.title'),
    content: t('common.discard_changes.content'),
    submitText: t('common.discard_changes.confirm'),
    danger: true,
  });

useLeaveGuard(hasUnsavedDraft, confirmDiscardDraft);

async function cancelEditMode() {
  if (hasUnsavedDraft.value && !(await confirmDiscardDraft())) return;
  leaveEditMode();
}

async function handleSaveAll() {
  if (await saveScheduleBatch(draftLessons.value, scheduleConfig.value)) {
    leaveEditMode();
  }
}

const isEditingConfig = ref(false);

const saveConfig = (config: ScheduleConfig) =>
  saveScheduleBatch(lessons.value, config);

// ----------------------------------------------------
// Lesson Selection & Context Menu Action State
// ----------------------------------------------------

// Native contextmenu handling (Hold on Mobile / Right-click on Desktop)
function handleContextMenu(lesson: Lesson, event?: UIEvent) {
  event?.preventDefault();
  selectOnly(lesson.id);
  mobileMenuOpen.value = true;
}

function handleLessonClick(lesson: Lesson, event?: MouseEvent) {
  // On Mobile: Tapping an existing lesson directly opens edit modal
  if (isMobile.value || !event) {
    openEditLessonModal(lesson);
    return;
  }
  selectByClick(lesson.id, event);
}

function handleAddLessonFromSelection() {
  const lesson = singleSelectedLesson.value;
  if (!lesson) return;
  mobileMenuOpen.value = false;
  openAddLessonModal(lesson.day, lesson.slot);
}

function handleEditLessonFromSelection() {
  const lesson = singleSelectedLesson.value;
  if (!lesson) return;
  mobileMenuOpen.value = false;
  openEditLessonModal(lesson);
}

function handleDeleteSelection() {
  if (selectedLessonIds.value.length === 0) return;
  const toDelete = new Set(selectedLessonIds.value);
  draftLessons.value = draftLessons.value.filter((l) => !toDelete.has(l.id));
  clearSelection();
  draftHistory.commit();
}

function handleWindowKeyDown(e: KeyboardEvent) {
  if (!isEditMode.value) return;
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      isLessonModalOpen.value)
  ) {
    return;
  }

  const isCtrlCmd = e.ctrlKey || e.metaKey;
  if (isCtrlCmd && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  if (isCtrlCmd && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }

  if (e.key === 'Escape') {
    if (selectedLessonIds.value.length > 0) {
      clearSelection();
    }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedLessonIds.value.length > 0) {
      handleDeleteSelection();
    }
  }
}

function handleGlobalClick(e: MouseEvent) {
  if (
    !isEditMode.value ||
    selectedLessonIds.value.length === 0 ||
    isLessonModalOpen.value
  ) {
    return;
  }
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const isLessonCard = !!target.closest('.js-lesson-card');
  const isInteractive = !!target.closest(
    'button, a, input, select, textarea, [role="button"], label, [role="dialog"]',
  );

  if (!isLessonCard && !isInteractive) {
    clearSelection();
  }
}

useEventListener('keydown', handleWindowKeyDown);
useEventListener('click', handleGlobalClick);

// ----------------------------------------------------
// Lesson Edit / Add Modal (Relational Schema Best Practices)
// ----------------------------------------------------
const isLessonModalOpen = ref(false);
const lessonForm = ref({
  id: '',
  day: 1,
  slot: 1,
  duration: 1,
  room: '',
  subjectId: '',
  courseId: '',
});

// Dalton has no subject row, so the form tells it apart by a value no subject
// id can take.
const DALTON_LESSON_OPTION = '__dalton__';

const isDaltonSelected = computed(
  () => lessonForm.value.subjectId === DALTON_LESSON_OPTION,
);

// Subject Options directly from group subjects table, plus the Dalton
// pseudo-subject while the group has it enabled.
const subjectOptions = computed(() => {
  const options = subjects.value.map((s) => ({
    label: subjectLabel(s.name, t, te),
    value: s.id,
  }));
  if (activeGroupDaltonEnabled.value) {
    options.push({
      label: t(`common.subjects.${DALTON_SUBJECT_KEY}`),
      value: DALTON_LESSON_OPTION,
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, locale.value));
});

// Selected Subject Object
const selectedSubjectObj = computed(() => {
  if (!lessonForm.value.subjectId || isDaltonSelected.value) return null;
  return (
    subjects.value.find((s) => s.id === lessonForm.value.subjectId) || null
  );
});

const lessonCourseOptions = computed(() => [
  {
    label: t('groups.settings.schedule.editor.select_course_prompt'),
    value: '',
  },
  ...(selectedSubjectObj.value?.courses ?? []).map((course) => ({
    label: courseOptionLabel(course, t, te),
    value: course.id,
  })),
]);

// The course field stays visible for a lesson that still carries one after the
// group switched back to regular, so it can be cleared there too.
const showLessonCourseField = computed(
  () =>
    (schedulesCoursesIndividually.value || !!lessonForm.value.courseId) &&
    (selectedSubjectObj.value?.courses?.length ?? 0) > 0,
);

// A course of another subject cannot stay selected when the subject changes.
watch(
  () => lessonForm.value.subjectId,
  () => {
    const courses = selectedSubjectObj.value?.courses ?? [];
    if (!courses.some((c) => c.id === lessonForm.value.courseId)) {
      lessonForm.value.courseId = '';
    }
  },
);

// Summary text for selected day & slot at top of modal
const selectedSlotSummary = computed(() => {
  const { day, slot } = lessonForm.value;
  const lastSlot = lessonLastSlot(lessonForm.value);
  const periods =
    slot === lastSlot
      ? t('schedule.period', { slot })
      : t('schedule.periods', { first: slot, last: lastSlot });
  const time = formatMinuteRange(
    slotRangeMinutes(scheduleConfig.value, day, slot, lastSlot),
  );
  return `${formatDayName(day)}, ${periods} (${time})`;
});

const editingLessonRef = ref<Lesson | null>(null);

// An edited lesson opened before the subjects arrived gets its subject once they do.
watch(subjects, (loadedSubjects) => {
  const lesson = editingLessonRef.value;
  if (!isLessonModalOpen.value || !lesson || lessonForm.value.subjectId) {
    return;
  }
  lessonForm.value.subjectId =
    findLessonSubject(lesson, loadedSubjects)?.id ?? '';
});

function openAddLessonModal(day: number, slot: number) {
  editingLessonRef.value = null;
  lessonForm.value = {
    id: '',
    day: Number(day),
    slot: Number(slot),
    duration: 1,
    room: '',
    subjectId: '',
    courseId: '',
  };
  isLessonModalOpen.value = true;
}

function openEditLessonModal(lesson: Lesson) {
  if (!lesson) return;
  editingLessonRef.value = lesson;

  const matchedSub = findLessonSubject(lesson, subjects.value);

  const matchedSubId = lesson.isDalton
    ? DALTON_LESSON_OPTION
    : (matchedSub?.id ?? '');

  const lessonCourseId = lesson.courseId || '';
  const matchedCourseId = matchedSub?.courses?.some(
    (c) => c.id === lessonCourseId,
  )
    ? lessonCourseId
    : '';

  lessonForm.value = {
    id: lesson.id,
    day: Number(lesson.day),
    slot: Number(lesson.slot),
    duration: Number(lesson.duration || 1),
    room: lesson.room || '',
    subjectId: matchedSubId,
    courseId: matchedCourseId,
  };
  isLessonModalOpen.value = true;
}

function goToSubjectSettings() {
  void router.push({
    name: 'group-admin',
    params: { groupId, tab: 'subjects' },
  });
}

function closeLessonModal() {
  isLessonModalOpen.value = false;
  editingLessonRef.value = null;
}

function submitLessonForm() {
  const targetId = lessonForm.value.id || draftId('les_draft');

  const newLesson = isDaltonSelected.value
    ? draftDaltonLesson(targetId)
    : draftSubjectLesson(targetId);
  if (!newLesson) return;

  const existingIdx = draftLessons.value.findIndex((l) => l.id === targetId);
  if (existingIdx !== -1) {
    draftLessons.value[existingIdx] = newLesson;
  } else {
    draftLessons.value.push(newLesson);
  }

  draftHistory.commit();
  closeLessonModal();
}

/** Where and in which room the form places a lesson, whatever it teaches. */
function draftLessonPlacement(id: string) {
  const form = lessonForm.value;
  return {
    id,
    day: Number(form.day),
    slot: Number(form.slot),
    duration: Number(form.duration || 1),
    room: form.room.trim() || null,
  };
}

function draftDaltonLesson(id: string): Lesson {
  return {
    ...draftLessonPlacement(id),
    subjectId: null,
    subjectName: null,
    courseId: null,
    courseName: null,
    isDalton: true,
  };
}

function draftSubjectLesson(id: string): Lesson | null {
  const subObj = selectedSubjectObj.value;
  if (!subObj) return null;

  const courseObj =
    subObj.courses?.find((c) => c.id === lessonForm.value.courseId) ?? null;

  return {
    ...draftLessonPlacement(id),
    subjectId: subObj.id,
    subjectName: subObj.name,
    courseId: courseObj?.id ?? null,
    courseName: courseObj?.name ?? null,
    isDalton: false,
  };
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div>
      <BasePageHeader>
        <span class="swap-stack">
          <Transition :name="isEditMode ? 'swap-wheel-down' : 'swap-wheel-up'">
            <span v-if="isEditMode" class="swap-text">
              {{ t('groups.settings.schedule.editor.title') }}
            </span>
            <span v-else class="swap-text">
              {{ t('groups.settings.schedule.lessons.title') }}
            </span>
          </Transition>
        </span>

        <template #info>
          <BaseInfoButton
            :tooltip="t('groups.settings.schedule.info.tooltip')"
            :title="t('groups.settings.schedule.info.title')"
          >
            <h3>
              {{ t('groups.settings.schedule.config.instruction_text') }}
            </h3>
          </BaseInfoButton>
        </template>

        <template #action>
          <div class="swap-stack justify-items-end">
            <Transition name="swap-icon">
              <div v-if="!isEditMode" class="flex items-center gap-2">
                <BaseTooltip
                  v-if="canEditScheduleConfig"
                  :content="
                    t('groups.settings.schedule.editor.edit_schedule_button')
                  "
                  placement="bottom"
                >
                  <BaseButton
                    variant="ghost"
                    :icon="Pencil"
                    :disabled="isEditingConfig"
                    @click="enterEditMode"
                  />
                </BaseTooltip>
              </div>

              <div v-else class="flex items-center gap-2">
                <BaseButton
                  v-if="windowWidth <= 768"
                  variant="ghost"
                  :icon="X"
                  @click="cancelEditMode"
                />
                <BaseButton
                  v-else
                  variant="ghost"
                  :icon="X"
                  @click="cancelEditMode"
                >
                  {{ t('groups.settings.schedule.editor.cancel_button') }}
                </BaseButton>

                <BaseButton
                  v-if="windowWidth <= 768"
                  variant="action"
                  :icon="Check"
                  :disabled="savingScheduleConfig"
                  @click="handleSaveAll"
                />
                <BaseButton
                  v-else
                  variant="action"
                  :icon="Check"
                  :disabled="savingScheduleConfig"
                  @click="handleSaveAll"
                >
                  {{
                    savingScheduleConfig
                      ? t('common.buttons.saving')
                      : t('groups.settings.schedule.editor.save_all_button')
                  }}
                </BaseButton>
              </div>
            </Transition>
          </div>
        </template>
      </BasePageHeader>

      <div v-if="isEditMode" class="flex flex-col gap-6">
        <div class="sm:p-6">
          <div
            class="grid transition-[grid-template-rows,opacity] ease-out"
            :style="{ transitionDuration: `${TOOLBAR_TRANSITION_MS}ms` }"
            :class="
              showToolbar
                ? 'grid-rows-[1fr] opacity-100'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            "
          >
            <div class="overflow-hidden min-h-0">
              <div class="pb-4">
                <div
                  class="flex flex-wrap items-center justify-between gap-2 sm:p-1 sm:rounded-2xl sm:border border-ghost-border sm:bg-surface sm:shadow-input"
                >
                  <div class="flex items-center gap-2">
                    <BaseTooltip
                      :content="t('groups.settings.schedule.editor.undo')"
                      placement="bottom"
                    >
                      <BaseButton
                        variant="ghost"
                        :icon="Undo2"
                        :disabled="!canUndo"
                        @click="undo"
                      />
                    </BaseTooltip>

                    <BaseTooltip
                      :content="t('groups.settings.schedule.editor.redo')"
                      placement="bottom"
                    >
                      <BaseButton
                        variant="ghost"
                        :icon="Redo2"
                        :disabled="!canRedo"
                        @click="redo"
                      />
                    </BaseTooltip>

                    <div
                      class="hidden sm:block h-4 w-px bg-ghost-border mx-1"
                    ></div>

                    <span
                      class="hidden sm:inline-block text-sm font-semibold text-on-ghost"
                      >{{
                        t('groups.settings.schedule.changes.selected_count', {
                          count: selectedLessonIds.length,
                        })
                      }}
                    </span>
                  </div>

                  <div class="hidden sm:flex flex-wrap items-center gap-2">
                    <BaseButton
                      variant="ghost"
                      :icon="Plus"
                      :disabled="!singleSelectedLesson"
                      @click="handleAddLessonFromSelection"
                    >
                      {{ t('groups.settings.schedule.editor.add_lesson_slot') }}
                    </BaseButton>
                    <BaseButton
                      variant="ghost"
                      :icon="Pencil"
                      :disabled="!singleSelectedLesson"
                      @click="handleEditLessonFromSelection"
                    >
                      {{
                        t('groups.settings.schedule.editor.edit_lesson_title')
                      }}
                    </BaseButton>
                    <BaseButton
                      variant="ghost"
                      :icon="Trash2"
                      :disabled="selectedLessonIds.length === 0"
                      @click="handleDeleteSelection"
                    >
                      {{
                        t(
                          'groups.settings.schedule.editor.delete_lesson_button',
                        )
                      }}
                    </BaseButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <GroupSettingsScheduleEditor
            :lessons="draftLessons"
            :subjects="subjects"
            is-editable
            :individual-courses="schedulesCoursesIndividually"
            :selected-lesson-ids="selectedDraftLessonIds"
            :animated="false"
            @select-lesson="handleLessonClick"
            @select-day="selectDay"
            @add-lesson="({ day, slot }) => openAddLessonModal(day, slot)"
            @contextmenu-lesson="handleContextMenu"
          />
        </div>

        <BaseRow stack-on-mobile justify="end">
          <BaseButton form variant="ghost" @click="cancelEditMode">
            {{ t('groups.settings.schedule.editor.cancel_button') }}
          </BaseButton>
          <BaseButton
            form
            variant="action"
            :disabled="savingScheduleConfig"
            @click="handleSaveAll"
          >
            {{
              savingScheduleConfig
                ? t('common.buttons.saving')
                : t('groups.settings.schedule.editor.save_all_button')
            }}
          </BaseButton>
        </BaseRow>
      </div>

      <div v-else class="sm:p-6">
        <div
          v-if="loadingLessons"
          class="text-center p-8 text-on-ghost-muted text-base"
        >
          {{ t('schedule.loading') }}
        </div>
        <GroupSettingsScheduleEditor
          v-else
          :lessons="lessons"
          :subjects="subjects"
          :individual-courses="schedulesCoursesIndividually"
          :animated="!hasSwitchedFromEditor"
        />
      </div>
    </div>

    <div v-show="!isEditMode" class="flex flex-col gap-8">
      <GroupSettingsScheduleConfig
        v-model:editing="isEditingConfig"
        :can-edit="canEditScheduleConfig"
        :saving="savingScheduleConfig"
        :save="saveConfig"
      />
      <GroupSettingsScheduleChanges :lessons="lessons" />
    </div>

    <BaseModal
      :open="isLessonModalOpen"
      :submit="
        subjectOptions.length > 0 ? submitLessonForm : goToSubjectSettings
      "
      :requirement="subjectOptions.length === 0 || !!lessonForm.subjectId"
      header-actions
      :close-button="subjectOptions.length !== 0"
      @cancel="closeLessonModal"
    >
      <template #title>
        {{
          lessonForm.id
            ? t('groups.settings.schedule.editor.edit_lesson_title')
            : t('groups.settings.schedule.editor.add_lesson_title')
        }}
      </template>

      <template #content>
        <div class="text-base text-on-ghost-muted">
          {{ selectedSlotSummary }}
        </div>

        <BaseEmptyState v-if="subjectOptions.length === 0" :icon="Library">
          {{ t('groups.settings.schedule.editor.no_subjects_title') }}
          <template #message>{{
            t('groups.settings.schedule.editor.no_subjects')
          }}</template>
        </BaseEmptyState>

        <template v-else>
          <BaseFormGroup id="lesson-subject">
            <BaseLabel for="lesson-subject-select" required>{{
              t('groups.settings.schedule.editor.subject_label')
            }}</BaseLabel>
            <BaseSelect
              id="lesson-subject-select"
              v-model="lessonForm.subjectId"
              :options="subjectOptions"
              classes="w-full"
            />
          </BaseFormGroup>

          <BaseFormGroup v-if="showLessonCourseField" id="lesson-course">
            <BaseLabel for="lesson-course-select">{{
              t('groups.settings.schedule.editor.course_label')
            }}</BaseLabel>
            <BaseSelect
              id="lesson-course-select"
              v-model="lessonForm.courseId"
              :options="lessonCourseOptions"
              classes="w-full"
            />
            <span class="text-xs text-on-ghost-muted mt-1">
              {{ t('groups.settings.schedule.editor.course_hint') }}
            </span>
          </BaseFormGroup>

          <BaseFormGroup id="lesson-room">
            <BaseLabel for="lesson-room-input">{{
              t('groups.settings.schedule.editor.room_label')
            }}</BaseLabel>
            <BaseInput
              id="lesson-room-input"
              v-model="lessonForm.room"
              :placeholder="
                t('groups.settings.schedule.editor.room_placeholder')
              "
            />
          </BaseFormGroup>

          <BaseFormGroup id="lesson-dur">
            <BaseLabel for="lesson-dur-input" required>{{
              t('groups.settings.schedule.editor.duration_label')
            }}</BaseLabel>
            <BaseInput
              id="lesson-dur-input"
              v-model.number="lessonForm.duration"
              type="number"
              min="1"
              max="6"
            />
          </BaseFormGroup>
        </template>
      </template>

      <template #action-text>
        {{
          subjectOptions.length > 0
            ? t('groups.settings.schedule.editor.save_lesson_button')
            : t('groups.settings.schedule.editor.set_up_subjects_button')
        }}
      </template>
    </BaseModal>

    <BaseMenu
      v-if="isEditMode"
      :open="mobileMenuOpen"
      @close="mobileMenuOpen = false"
      @cancel="mobileMenuOpen = false"
    >
      <BaseMenuButton
        :icon="Plus"
        :disabled="!singleSelectedLesson"
        @click="handleAddLessonFromSelection"
      >
        {{ t('groups.settings.schedule.editor.add_lesson_slot') }}
      </BaseMenuButton>
      <BaseMenuButton
        :icon="Pencil"
        :disabled="!singleSelectedLesson"
        @click="handleEditLessonFromSelection"
      >
        {{ t('groups.settings.schedule.editor.edit_lesson_title') }}
      </BaseMenuButton>
      <BaseMenuButton
        danger
        :icon="Trash2"
        :disabled="selectedLessonIds.length === 0"
        @click="handleDeleteSelection"
      >
        {{ t('groups.settings.schedule.editor.delete_lesson_button') }}
      </BaseMenuButton>
    </BaseMenu>
  </div>
</template>
