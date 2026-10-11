<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { GraduationCap, RotateCcw } from '@lucide/vue';
import { useSubjectStore } from '@/modules/courses/stores/useSubjectStore';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useCourseSelection } from '@/modules/courses/composables/useCourseSelection';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { useToast } from '@/common/composables/useToast';
import { apiErrorMessage } from '@/api/errors';

const { t } = useI18n();
const router = useRouter();
const groupId = useGroupPageId();
const toast = useToast();
const subjectStore = useSubjectStore();
const userStore = useUserStore();
const confirmModal = useConfirmModal();
const {
  selections,
  resetSelections,
  translatedName,
  optionsForSubject,
  selectedCourses,
  saveCourses,
  resetCourses,
} = useCourseSelection(groupId);

const saving = ref(false);

const courseSubjects = computed(() => [
  ...subjectStore.requiredCourseSubjects.map((subject) => ({
    subject,
    optional: false,
  })),
  ...subjectStore.optionalCourseSubjects.map((subject) => ({
    subject,
    optional: true,
  })),
]);

function showSavedCourses() {
  resetSelections(userStore.user?.courses ?? []);
}

// Saved courses can change outside this form, so they replace what is shown.
watch(
  () => [
    subjectStore.requiredCourseSubjects,
    subjectStore.optionalCourseSubjects,
    userStore.user?.courses,
  ],
  showSavedCourses,
  { immediate: true },
);

void subjectStore.loadSubjects(groupId);

async function selectCourse(subjectId: string, courseId: string) {
  selections[subjectId] = courseId;
  saving.value = true;
  try {
    await saveCourses(selectedCourses.value);
  } catch (e: unknown) {
    showSavedCourses();
    toast.error(apiErrorMessage(e, t('auth.courses.errors.save')));
  } finally {
    saving.value = false;
  }
}

const redoing = ref(false);

async function redoSetup() {
  const confirmed = await confirmModal.ask({
    title: t('auth.courses.redo_setup.title'),
    content: t('auth.courses.redo_setup.message'),
    submitText: t('auth.courses.redo_setup.submit'),
    danger: true,
  });
  if (!confirmed) return;

  redoing.value = true;
  try {
    await resetCourses();
    await router.push({
      name: 'group-course-setup',
      params: { groupId },
      query: { returnTo: 'settings' },
    });
  } catch (e: unknown) {
    toast.error(apiErrorMessage(e, t('auth.courses.errors.save')));
  } finally {
    redoing.value = false;
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div
      class="flex w-full max-w-160 flex-col items-start gap-3 mb-4 md:flex-row md:items-center md:justify-between mx-auto"
    >
      <p class="text-base/relaxed text-on-ghost-muted m-0!">
        {{ t('auth.courses.description') }}
      </p>
      <BaseButton
        v-if="courseSubjects.length > 0"
        form
        class="shrink-0"
        :icon="RotateCcw"
        :loading="redoing"
        :disabled="redoing || saving"
        @click="redoSetup"
      >
        {{ t('auth.courses.redo_setup.button') }}
      </BaseButton>
    </div>

    <div v-if="subjectStore.loading" class="flex justify-center">
      <BaseSpinner />
    </div>

    <BaseEmptyState
      v-else-if="courseSubjects.length === 0"
      class="flex-1"
      :icon="GraduationCap"
    >
      {{ t('auth.courses.none_offered') }}
    </BaseEmptyState>

    <div v-else class="flex max-w-150 flex-col mx-auto max-md:-mx-6 md:w-full">
      <BaseList
        v-for="({ subject, optional }, index) in courseSubjects"
        :key="subject.id"
        select
        :separator="index !== courseSubjects.length - 1"
        :model-value="selections[subject.id] ?? ''"
        :options="optionsForSubject(subject, optional)"
        :title="translatedName(subject.name)"
        :disabled="saving || redoing"
        @update:model-value="selectCourse(subject.id, $event)"
      >
        <template #label>
          {{ translatedName(subject.name) }}
        </template>
      </BaseList>
    </div>
  </div>
</template>
