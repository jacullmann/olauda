<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Library, Plus, Pencil, Trash2, Search } from '@lucide/vue';
import { useSubjectAdmin } from '@/modules/groups/composables/useSubjectAdmin';
import { useGroupGeneralSettings } from '@/modules/groups/composables/useGroupGeneralSettings';
import { useConfirmModal } from '@/stores/modalStore';
import {
  CUSTOM_SUBJECT_OPTION,
  useSubjectNamePicker,
} from '@/modules/groups/composables/useSubjectNamePicker';
import { courseLabel, subjectLabel } from '@/utils/subject-formatter';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import {
  categoryBelongsTo,
  courseSelectionFor,
  courseTypeIsSelectable,
  DEFAULT_COURSE_TYPE,
  defaultSubjectCategory,
  normalizeSubjectCategory,
  resolveCourseType,
  SELECTABLE_COURSE_TYPES,
  subjectCategoriesFor,
  usesCourseTypes,
  ZUSATZKURS_CATEGORY,
  COURSE_NAME_MAX_LENGTH,
  SUBJECT_NAME_MAX_LENGTH,
  type CourseType,
} from '@/types/subjects';
import type { AdminCourse } from '@/modules/groups/types';
import { rankByQuery } from '@/utils/search-rank';

const i18n = useI18n();
const { t } = i18n;

const route = useRoute();
const router = useRouter();

const {
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
} = useSubjectAdmin();

const { checkPermission, activeGroupType, activeGroupDaltonEnabled } =
  useAppAuth();
const canEditSubjects = computed(() =>
  checkPermission('edit_subjects_courses'),
);
const canEditDalton = computed(() =>
  checkPermission('edit_group_configuration'),
);

const confirmModal = useConfirmModal();
const { savingDaltonEnabled, saveDaltonEnabled } = useGroupGeneralSettings();
const daltonInput = ref(activeGroupDaltonEnabled.value);

watch(activeGroupDaltonEnabled, (enabled) => {
  daltonInput.value = enabled;
});

async function changeDaltonEnabled(enabled: boolean) {
  daltonInput.value = enabled;

  // Disabling removes every Dalton lesson from the schedule.
  if (!enabled) {
    const isConfirmed = await confirmModal.ask({
      title: t('groups.settings.general.dalton.modal.title'),
      content: t('groups.settings.general.dalton.modal.message'),
      submitText: t('common.buttons.save'),
      danger: true,
    });

    if (!isConfirmed) {
      daltonInput.value = activeGroupDaltonEnabled.value;
      return;
    }
  }

  const ok = await saveDaltonEnabled(enabled);
  if (!ok) daltonInput.value = activeGroupDaltonEnabled.value;
}

const newSubjectNamePicker = useSubjectNamePicker();
const newSubjectCategory = ref(defaultSubjectCategory(activeGroupType.value));
const newSubjectIsDalton = ref(false);
const showCreateModal = ref(false);
const newSubjectInputRef = ref<any>(null);

watch(newSubjectNamePicker.selection, async (selection) => {
  if (selection !== CUSTOM_SUBJECT_OPTION) return;
  newSubjectNamePicker.customName.value = '';
  await nextTick();
  newSubjectInputRef.value?.focus();
});

const groupId = computed(() => route.params.groupId as string);
const subTabId = computed(() => route.params.subTab as string | undefined);
const subject = computed(() => {
  if (!subTabId.value) return null;
  return subjects.value.find((s) => s.id === subTabId.value) || null;
});

const subjectNamePicker = useSubjectNamePicker();
const subjectCategoryInput = ref(defaultSubjectCategory(activeGroupType.value));
const subjectIsDaltonInput = ref(false);

function categoryLabel(category: string): string {
  const key = `groups.settings.subjects.categories.${category}`;
  return i18n.te(key) ? t(key) : category.toUpperCase();
}

const categoryOptions = computed(() =>
  subjectCategoriesFor(activeGroupType.value).map((category) => ({
    value: category,
    label: categoryLabel(category),
  })),
);

// A group that switched its type keeps subjects categorised for the old type
// until they are saved again; the form offers the closest current category.
const storedCategory = computed(() => subject.value?.category ?? '');
const categoryNeedsMigration = computed(
  () =>
    !!storedCategory.value &&
    !categoryBelongsTo(storedCategory.value, activeGroupType.value),
);

function subjectHasCourses(category: string | undefined): boolean {
  return courseSelectionFor(category) !== 'none';
}

function coursesCountLabel(count: number): string {
  if (count === 0) return t('groups.settings.subjects.courses_count_zero');
  if (count === 1) return t('groups.settings.subjects.courses_count_singular');
  return t('groups.settings.subjects.courses_count_plural', { count });
}

const translationExists = (key: string) => i18n.te(key);

const searchQuery = ref('');
const filteredSubjects = computed(() =>
  rankByQuery(subjects.value, searchQuery.value, (sub) => [
    { text: subjectLabel(sub.name, t, translationExists), weight: 1 },
    { text: categoryLabel(sub.category || ''), weight: 0.6 },
    ...(sub.courses ?? []).map((course) => ({
      text: courseLabel(course.name, t, translationExists),
      weight: 0.7,
    })),
  ]),
);

function courseTypeLabel(courseType: string): string {
  const key = `groups.settings.subjects.course_types.${courseType}`;
  return i18n.te(key) ? t(key) : courseType.toUpperCase();
}

function courseTypeShortLabel(courseType: string): string {
  const key = `groups.settings.subjects.course_types_short.${courseType}`;
  return i18n.te(key) ? t(key) : courseType.toUpperCase();
}

const courseTypeOptions = computed(() =>
  SELECTABLE_COURSE_TYPES.map((courseType) => ({
    value: courseType,
    label: courseTypeLabel(courseType),
  })),
);

// A Zusatzkurs subject types its courses itself, and a regular group has no
// course types at all — only then does the form offer the choice.
const showCourseTypeField = computed(() =>
  courseTypeIsSelectable(subjectCategoryInput.value, activeGroupType.value),
);

const coursesAreForcedZk = computed(
  () =>
    usesCourseTypes(activeGroupType.value) &&
    subjectCategoryInput.value === ZUSATZKURS_CATEGORY,
);

/** The type a course of the subject currently being edited would get. */
function effectiveCourseType(requested: unknown): CourseType | null {
  return resolveCourseType(
    subjectCategoryInput.value,
    activeGroupType.value,
    requested,
  );
}

function toCategory(value: string) {
  return normalizeSubjectCategory(value, activeGroupType.value);
}

// Keep both forms on categories the group currently offers, even when the type
// is switched in another tab while this one stays mounted.
watch(activeGroupType, (groupType) => {
  newSubjectCategory.value = normalizeSubjectCategory(
    newSubjectCategory.value,
    groupType,
  );
  subjectCategoryInput.value = normalizeSubjectCategory(
    subject.value?.category ?? subjectCategoryInput.value,
    groupType,
  );
});

// Sync subject name and category inputs when subject loads or changes
watch(
  subject,
  (newSub) => {
    if (newSub) {
      subjectNamePicker.load(newSub.name);
      subjectCategoryInput.value = normalizeSubjectCategory(
        newSub.category,
        activeGroupType.value,
      );
      subjectIsDaltonInput.value = newSub.isDalton === true;
    }
  },
  { immediate: true },
);

function resetSubjectName() {
  if (subject.value) {
    subjectNamePicker.load(subject.value.name);
    subjectCategoryInput.value = normalizeSubjectCategory(
      subject.value.category,
      activeGroupType.value,
    );
    subjectIsDaltonInput.value = subject.value.isDalton === true;
  }
}

const subjectChanged = computed(
  () =>
    !!subject.value &&
    (subjectNamePicker.storedName.value !== subject.value.name ||
      subjectCategoryInput.value !== storedCategory.value ||
      subjectIsDaltonInput.value !== (subject.value.isDalton === true)),
);

async function handleSave() {
  if (!subject.value) return;
  const name = subjectNamePicker.storedName.value;
  if (!name) return;
  await updateSubject(subject.value.id, {
    name,
    category: subjectCategoryInput.value,
    isDalton: subjectIsDaltonInput.value,
  });
}

async function handleDelete() {
  if (!subject.value) return;
  const ok = await deleteSubject(subject.value.id);
  if (ok) {
    void router.push({
      name: 'group-admin',
      params: { groupId: groupId.value, tab: 'subjects' },
    });
  }
}

function goToSubject(id: string) {
  void router.push({
    name: 'group-admin',
    params: { groupId: groupId.value, tab: 'subjects', subTab: id },
  });
}

function openCreateModal() {
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
  newSubjectNamePicker.reset();
  newSubjectCategory.value = defaultSubjectCategory(activeGroupType.value);
  newSubjectIsDalton.value = false;
}

async function handleCreate() {
  const name = newSubjectNamePicker.storedName.value;
  if (!name) return;
  const oldLength = subjects.value.length;
  await createSubject(
    name,
    newSubjectCategory.value,
    activeGroupDaltonEnabled.value && newSubjectIsDalton.value,
  );
  if (subjects.value.length > oldLength) {
    newSubjectNamePicker.reset();
    newSubjectCategory.value = defaultSubjectCategory(activeGroupType.value);
    newSubjectIsDalton.value = false;
    showCreateModal.value = false;
  }
}

watch(showCreateModal, async (open) => {
  if (open) {
    await nextTick();
    if (newSubjectNamePicker.isCustom.value) {
      newSubjectInputRef.value?.focus();
    }
  }
});

const showCreateCourseModal = ref(false);
const newCourseName = ref('');
const newCourseType = ref<CourseType>(DEFAULT_COURSE_TYPE);

const showEditCourseModal = ref(false);
const editingCourse = ref<AdminCourse | null>(null);
const editCourseName = ref('');
const editCourseType = ref<CourseType>(DEFAULT_COURSE_TYPE);

function openCreateCourseModal() {
  newCourseName.value = '';
  newCourseType.value = DEFAULT_COURSE_TYPE;
  showCreateCourseModal.value = true;
}

async function handleCreateCourse() {
  if (!subject.value || !newCourseName.value.trim()) return;
  const ok = await createCourse(
    subject.value.id,
    newCourseName.value,
    effectiveCourseType(newCourseType.value),
  );
  if (ok) {
    showCreateCourseModal.value = false;
    newCourseName.value = '';
    newCourseType.value = DEFAULT_COURSE_TYPE;
  }
}

function openEditCourseModal(course: AdminCourse) {
  editingCourse.value = course;
  editCourseName.value = course.name;
  editCourseType.value =
    course.courseType && course.courseType !== 'zk'
      ? course.courseType
      : DEFAULT_COURSE_TYPE;
  showEditCourseModal.value = true;
}

const editCourseChanged = computed(
  () =>
    editCourseName.value.trim() !== (editingCourse.value?.name || '') ||
    effectiveCourseType(editCourseType.value) !==
      (editingCourse.value?.courseType ?? null),
);

async function handleEditCourse() {
  if (!subject.value || !editingCourse.value || !editCourseName.value.trim())
    return;
  const ok = await updateCourse(
    subject.value.id,
    editingCourse.value.id,
    editCourseName.value,
    effectiveCourseType(editCourseType.value),
  );
  if (ok) {
    showEditCourseModal.value = false;
    editingCourse.value = null;
    editCourseName.value = '';
    editCourseType.value = DEFAULT_COURSE_TYPE;
  }
}

async function handleDeleteCourse(courseId: string) {
  if (!subject.value) return;
  await deleteCourse(subject.value.id, courseId);
}

onMounted(() => {
  void loadSubjects();
});
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- List View -->
    <div v-if="!subTabId" class="flex flex-1 flex-col">
      <PageHeader>
        <template #action>
          <BaseTooltip
            v-if="canEditSubjects"
            :content="t('common.buttons.add')"
            placement="bottom"
          >
            <BaseButton
              variant="action"
              :icon="Plus"
              icon-classes="size-6"
              @click="openCreateModal"
            />
          </BaseTooltip>
        </template>
      </PageHeader>

      <div class="flex max-w-200 flex-col mx-auto mb-4 max-md:-mx-6 md:w-full">
        <BaseList
          :checked="daltonInput"
          toggle
          :separator="false"
          :disabled="!canEditDalton || savingDaltonEnabled"
          @update:checked="changeDaltonEnabled"
        >
          <template #label>
            {{ t('groups.settings.general.dalton.toggle_title') }}
          </template>
          <template #desc>
            {{ t('groups.settings.general.dalton.toggle_description') }}
          </template>
        </BaseList>
      </div>

      <div
        v-if="loading && subjects.length === 0"
        class="flex justify-center p-8"
      >
        <BaseSpinner />
      </div>
      <BaseEmptyState
        v-else-if="subjects.length === 0"
        class="flex-1"
        :icon="Library"
      >
        {{ t('groups.settings.subjects.list.empty') }}
      </BaseEmptyState>

      <template v-else>
        <div class="w-full max-w-200 mx-auto mb-4">
          <BaseSearchInput
            id="group-subject-search"
            v-model="searchQuery"
            :placeholder="t('groups.settings.subjects.search_placeholder')"
          />
        </div>

        <BaseEmptyState
          v-if="filteredSubjects.length === 0"
          class="flex-1"
          :icon="Search"
        >
          <template #default>{{
            t('common.search_results.empty_title', {
              query: searchQuery.trim(),
            })
          }}</template>
          <template #message>{{
            t('common.search_results.empty_message')
          }}</template>
        </BaseEmptyState>

        <div
          v-else
          class="flex max-w-200 flex-col mx-auto max-md:-mx-6 md:w-full"
        >
          <BaseList
            v-for="(sub, index) in filteredSubjects"
            :key="sub.id"
            class="cursor-pointer"
            :separator="index !== filteredSubjects.length - 1"
            @click="goToSubject(sub.id)"
          >
            <template #label>{{ subjectLabel(sub.name, t, i18n.te) }}</template>
            <template #desc>
              {{
                categoryLabel(sub.category || '') +
                (subjectHasCourses(sub.category)
                  ? `, ${coursesCountLabel(sub.courses?.length ?? 0)}`
                  : '') +
                (activeGroupDaltonEnabled && sub.isDalton
                  ? `, ${t('groups.settings.subjects.dalton_badge')}`
                  : '')
              }}
            </template>
          </BaseList>
        </div>
      </template>

      <BaseModal
        :open="showCreateModal"
        :submit="handleCreate"
        :loading="saving"
        :requirement="!!newSubjectNamePicker.storedName.value"
        header-actions
        @cancel="closeCreateModal"
      >
        <template #title>
          {{ t('groups.settings.subjects.create_title') }}
        </template>

        <template #content>
          <BaseFormGroup id="new-subject-name">
            <BaseLabel for="new-subject-name" required>{{
              t('groups.settings.subjects.name_label')
            }}</BaseLabel>
            <BaseSelect
              id="new-subject-name"
              v-model="newSubjectNamePicker.selection.value"
              :disabled="saving"
              :options="newSubjectNamePicker.options.value"
            />
          </BaseFormGroup>
          <BaseFormGroup
            v-if="newSubjectNamePicker.isCustom.value"
            id="new-subject-custom"
          >
            <BaseLabel for="new-subject-custom" required>{{
              t('groups.settings.subjects.custom_label')
            }}</BaseLabel>
            <BaseInput
              id="new-subject-custom"
              ref="newSubjectInputRef"
              v-model="newSubjectNamePicker.customName.value"
              :maxlength="SUBJECT_NAME_MAX_LENGTH"
              :placeholder="t('groups.settings.subjects.add_placeholder')"
              :disabled="saving"
            />
          </BaseFormGroup>
          <BaseFormGroup id="new-subject-category">
            <BaseLabel for="new-subject-category" required>{{
              t('groups.settings.subjects.category_label')
            }}</BaseLabel>
            <BaseSelect
              id="new-subject-category"
              :model-value="newSubjectCategory"
              :disabled="saving"
              :options="categoryOptions"
              @update:model-value="
                (value) => (newSubjectCategory = toCategory(value))
              "
            />
          </BaseFormGroup>
          <BaseFormGroup
            v-if="activeGroupDaltonEnabled"
            id="new-subject-dalton"
          >
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium" for="new-subject-dalton">{{
                t('groups.settings.subjects.dalton_label')
              }}</label>
              <BaseToggle
                id="new-subject-dalton"
                v-model="newSubjectIsDalton"
                :disabled="saving"
              />
            </div>
          </BaseFormGroup>
        </template>

        <template #action-text>
          {{ t('common.buttons.add') }}
        </template>
      </BaseModal>
    </div>

    <!-- Detail View -->
    <div
      v-else-if="loading && subjects.length === 0"
      class="flex justify-center p-8"
    >
      <BaseSpinner />
    </div>
    <div
      v-else-if="!subject"
      class="text-center p-8 text-on-ghost-muted text-base"
    >
      {{ t('groups.settings.subjects.errors.load') }}
    </div>
    <div v-else class="flex flex-col gap-8">
      <div>
        <PageHeader>{{
          t('groups.settings.subjects.appearance_title')
        }}</PageHeader>
        <BaseFormContent class="max-w-120">
          <BaseFormGroup id="subject-name">
            <BaseLabel for="subject-name">{{
              t('groups.settings.subjects.name_label')
            }}</BaseLabel>
            <BaseSelect
              id="subject-name"
              v-model="subjectNamePicker.selection.value"
              class="w-full"
              :disabled="saving || !canEditSubjects"
              :options="subjectNamePicker.options.value"
            />
          </BaseFormGroup>
          <BaseFormGroup
            v-if="subjectNamePicker.isCustom.value"
            id="subject-custom-name"
          >
            <BaseLabel for="subject-custom-name" required>{{
              t('groups.settings.subjects.custom_label')
            }}</BaseLabel>
            <BaseInput
              id="subject-custom-name"
              v-model="subjectNamePicker.customName.value"
              class="w-full"
              :maxlength="SUBJECT_NAME_MAX_LENGTH"
              :disabled="saving || !canEditSubjects"
              @keyup.enter="handleSave"
            />
          </BaseFormGroup>

          <BaseFormGroup id="subject-category">
            <BaseLabel for="subject-category">{{
              t('groups.settings.subjects.category_label')
            }}</BaseLabel>
            <BaseSelect
              id="subject-category"
              :model-value="subjectCategoryInput"
              class="w-full"
              :disabled="saving || !canEditSubjects"
              :options="categoryOptions"
              @update:model-value="
                (value) => (subjectCategoryInput = toCategory(value))
              "
            />
            <span v-if="categoryNeedsMigration" class="text-xs text-warn mt-1">
              {{
                t('groups.settings.subjects.category_mismatch', {
                  category: categoryLabel(storedCategory),
                })
              }}
            </span>
          </BaseFormGroup>

          <BaseFormGroup v-if="activeGroupDaltonEnabled" id="subject-dalton">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium" for="subject-dalton">{{
                t('groups.settings.subjects.dalton_label')
              }}</label>
              <BaseToggle
                id="subject-dalton"
                v-model="subjectIsDaltonInput"
                :disabled="saving || !canEditSubjects"
              />
            </div>
          </BaseFormGroup>

          <BaseRow v-if="canEditSubjects" stack-on-mobile justify="end">
            <BaseButton
              form
              variant="ghost"
              :disabled="saving"
              @click="resetSubjectName"
            >
              {{ t('common.buttons.cancel') }}
            </BaseButton>
            <BaseButton
              form
              :disabled="
                saving || !subjectNamePicker.storedName.value || !subjectChanged
              "
              variant="action"
              @click="handleSave"
            >
              {{
                saving ? t('common.buttons.saving') : t('common.buttons.save')
              }}
            </BaseButton>
          </BaseRow>
        </BaseFormContent>
      </div>

      <!-- Courses list section for elective/extra subjects -->
      <div v-if="subjectHasCourses(subject.category)">
        <div class="flex items-center justify-between mb-4 gap-4">
          <div class="flex flex-col">
            <h3 class="text-lg font-semibold text-on-ghost m-0">
              {{ t('groups.settings.subjects.courses_title') }}
            </h3>
            <span v-if="coursesAreForcedZk" class="text-sm text-on-ghost-muted">
              {{ t('groups.settings.subjects.course_type_forced_zk') }}
            </span>
          </div>
          <BaseTooltip
            :content="t('groups.settings.subjects.course_add_title')"
            placement="bottom"
          >
            <BaseButton
              v-if="canEditSubjects"
              variant="action"
              :icon="Plus"
              icon-classes="size-6"
              @click="openCreateCourseModal"
            />
          </BaseTooltip>
        </div>

        <div
          v-if="!subject.courses || subject.courses.length === 0"
          class="text-center p-8 text-on-ghost-muted text-base"
        >
          {{ t('groups.settings.subjects.courses_empty') }}
        </div>
        <div v-else class="flex flex-col max-w-200 mx-auto">
          <template v-for="(course, index) in subject.courses" :key="course.id">
            <div v-if="index > 0" class="separator"></div>
            <div class="flex items-center justify-between py-3 gap-2">
              <span class="font-medium text-base text-on-ghost truncate">
                {{ courseLabel(course.name, t, i18n.te) }}
                <span
                  v-if="course.courseType"
                  class="font-normal text-on-ghost-muted"
                  >{{ courseTypeShortLabel(course.courseType) }}</span
                >
              </span>
              <div v-if="canEditSubjects" class="flex gap-1">
                <BaseButton
                  variant="ghost"
                  :icon="Pencil"
                  @click="openEditCourseModal(course)"
                />
                <BaseButton
                  variant="ghost"
                  :icon="Trash2"
                  @click="handleDeleteCourse(course.id)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Create Course Modal -->
      <BaseModal
        :open="showCreateCourseModal"
        :submit="handleCreateCourse"
        :loading="saving"
        :requirement="!!newCourseName.trim()"
        header-actions
        @cancel="showCreateCourseModal = false"
      >
        <template #title>
          {{ t('groups.settings.subjects.course_add_title') }}
        </template>

        <template #content>
          <BaseFormGroup id="new-course-name" class="flex flex-col gap-2">
            <BaseLabel for="new-course-name" required>{{
              t('groups.settings.subjects.course_name_label')
            }}</BaseLabel>
            <BaseInput
              id="new-course-name"
              v-model="newCourseName"
              :maxlength="COURSE_NAME_MAX_LENGTH"
              :placeholder="t('groups.settings.subjects.course_name_label')"
              :disabled="saving"
              @keyup.enter="handleCreateCourse"
            />
          </BaseFormGroup>
          <BaseFormGroup
            v-if="showCourseTypeField"
            id="new-course-type"
            class="flex flex-col gap-2"
          >
            <BaseLabel for="new-course-type" required>{{
              t('groups.settings.subjects.course_type_label')
            }}</BaseLabel>
            <BaseSelect
              id="new-course-type"
              v-model="newCourseType"
              :disabled="saving"
              :options="courseTypeOptions"
            />
          </BaseFormGroup>
        </template>

        <template #action-text>
          {{ t('common.buttons.add') }}
        </template>
      </BaseModal>

      <!-- Edit Course Modal -->
      <BaseModal
        :open="showEditCourseModal"
        :submit="handleEditCourse"
        :loading="saving"
        :requirement="!!editCourseName.trim() && editCourseChanged"
        @cancel="showEditCourseModal = false"
      >
        <template #title>
          {{ t('groups.settings.subjects.course_edit_title') }}
        </template>

        <template #content>
          <BaseFormGroup id="edit-course-name" class="flex flex-col gap-2">
            <BaseLabel for="edit-course-name" required>{{
              t('groups.settings.subjects.course_name_label')
            }}</BaseLabel>
            <BaseInput
              id="edit-course-name"
              v-model="editCourseName"
              :maxlength="COURSE_NAME_MAX_LENGTH"
              :placeholder="t('groups.settings.subjects.course_name_label')"
              :disabled="saving"
              @keyup.enter="handleEditCourse"
            />
          </BaseFormGroup>
          <BaseFormGroup
            v-if="showCourseTypeField"
            id="edit-course-type"
            class="flex flex-col gap-2"
          >
            <BaseLabel for="edit-course-type" required>{{
              t('groups.settings.subjects.course_type_label')
            }}</BaseLabel>
            <BaseSelect
              id="edit-course-type"
              v-model="editCourseType"
              :disabled="saving"
              :options="courseTypeOptions"
            />
          </BaseFormGroup>
        </template>

        <template #action-text>
          {{ t('common.buttons.save') }}
        </template>
      </BaseModal>

      <div v-if="canEditSubjects">
        <h3 class="text-danger mt-6 mb-2">
          {{ t('groups.settings.general.delete_group.danger_zone_title') }}
        </h3>
        <p class="text-base/relaxed text-on-ghost-muted m-0 mb-5">
          {{ t('groups.settings.subjects.delete_modal.message') }}
        </p>
        <BaseButton form type="button" variant="danger" @click="handleDelete">
          {{ t('common.buttons.delete') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
