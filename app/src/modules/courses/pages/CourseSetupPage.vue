<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { useSubjectStore } from '@/modules/courses/stores/useSubjectStore';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import {
  useCourseSelection,
  type Enrollment,
} from '@/modules/courses/composables/useCourseSelection';
import { useCourseSetup } from '@/modules/courses/composables/useCourseSetup';
import { usePersonalization } from '@/modules/account/composables/usePersonalization';
import { useGroupPageId } from '@/modules/groups/composables/useGroupPageId';
import { apiErrorMessage } from '@/api/errors';
import { entranceDelay } from '@/common/utils/entrance';
import CourseLevelPicker from '@/modules/courses/components/CourseLevelPicker.vue';
import CourseSetupSchedule from '@/modules/courses/components/CourseSetupSchedule.vue';
import CourseSetupStatus from '@/modules/courses/components/CourseSetupStatus.vue';
import { SCROLL_LAYOUT_TO_TOP } from '@/shell/pages/AppSimpleLayout.vue';

const DESCRIPTION_ENTRANCE_ORDER = 1;
const CONTENT_ENTRANCE_ORDER = 2;
const ACTIONS_ENTRANCE_ORDER = 3;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const groupId = useGroupPageId();
const subjectStore = useSubjectStore();
const userStore = useUserStore();
const { setPersonalization } = usePersonalization();
const scrollLayoutToTop = inject(SCROLL_LAYOUT_TO_TOP, () =>
  window.scrollTo({ top: 0, behavior: 'instant' }),
);

const {
  selections,
  resetSelections,
  translatedName,
  optionsForSubject,
  hasRequiredSelections,
  selectedCourses,
  saveCourses,
} = useCourseSelection(groupId);

const {
  levelChoiceSubjects,
  levelOptions,
  levels,
  hasAllLevels,
  needsLessonChoice,
  loadingLessons,
  lessonsError,
  retryLessons,
  scheduleConfig,
  setupLessons,
  resolution,
  toggleCourse,
  canToggleCourse,
  enrollments,
  openSubjects,
} = useCourseSetup(groupId);

type Step = 'levels' | 'lessons';

const step = ref<Step>('levels');
const saving = ref(false);
const error = ref('');

// Members redoing their setup from the settings go back there once done.
const finishedRoute = computed<RouteLocationRaw>(() =>
  route.query.returnTo === 'settings'
    ? { name: 'group-admin', params: { groupId, tab: 'courses' } }
    : { name: 'group-dashboard', params: { groupId } },
);

const isAbitur = computed(() => subjectStore.groupType === 'abitur');
const hasLevelChoices = computed(() => levelChoiceSubjects.value.length > 0);
// Without a level to choose, the timetable is all there is to ask.
const isLessonStep = computed(
  () => isAbitur.value && (step.value === 'lessons' || !hasLevelChoices.value),
);
const hasCourseSubjects = computed(
  () =>
    subjectStore.requiredCourseSubjects.length > 0 ||
    subjectStore.optionalCourseSubjects.length > 0,
);
const loading = computed(
  () => subjectStore.loading || (isLessonStep.value && loadingLessons.value),
);

void subjectStore.loadSubjects(groupId);

watch(
  () => [
    subjectStore.requiredCourseSubjects,
    subjectStore.optionalCourseSubjects,
  ],
  () => resetSelections(userStore.user?.courses ?? []),
  { immediate: true },
);

// Fetched while the member picks levels, so the timetable is there on Continue.
watch(
  () => isLessonStep.value && !loadingLessons.value && lessonsError.value,
  (e) => {
    error.value = e ? apiErrorMessage(e, t('schedule.errors.load')) : '';
  },
  { immediate: true },
);

const description = computed(() => {
  if (!isAbitur.value) return t('auth.courses.description_creation');
  return isLessonStep.value
    ? t('auth.courses.description_lessons')
    : t('auth.courses.description_levels');
});

const submitLabel = computed(() =>
  isAbitur.value && !isLessonStep.value && needsLessonChoice.value
    ? t('common.buttons.continue')
    : t('common.buttons.done'),
);

const hasOpenLessons = computed(
  () => isLessonStep.value && openSubjects.value.length > 0,
);

const openSubjectNames = computed(() =>
  openSubjects.value.map((subject) => translatedName(subject.name)),
);

// Skipping leaves the member without courses, so "only mine" would hide everything.
async function saveAndFinish(courses: Enrollment[], personalized: boolean) {
  if (saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    await saveCourses(courses);
    if (userStore.user?.personalized !== personalized) {
      await setPersonalization(personalized);
    }
    // Replaced, so going back never lands in a setup that is already done.
    await router.replace(finishedRoute.value);
  } catch (e: unknown) {
    console.error('Course setup failed:', e);
    error.value = apiErrorMessage(e, t('auth.courses.errors.save'));
  } finally {
    saving.value = false;
  }
}

function showLessonStep() {
  error.value = '';
  step.value = 'lessons';
  scrollLayoutToTop();
  if (lessonsError.value) retryLessons();
}

async function submit() {
  if (isLessonStep.value) return saveAndFinish(enrollments.value, true);

  if (isAbitur.value ? !hasAllLevels.value : !hasRequiredSelections.value) {
    error.value = t('auth.courses.errors.required_courses_missing');
    return;
  }

  if (isAbitur.value) {
    return needsLessonChoice.value
      ? showLessonStep()
      : saveAndFinish(enrollments.value, true);
  }
  return saveAndFinish(selectedCourses.value, true);
}

const skip = () => saveAndFinish([], false);

function goBack() {
  error.value = '';
  step.value = 'levels';
}
</script>

<template>
  <form
    novalidate
    class="flex flex-col w-full max-md:self-stretch"
    :class="isLessonStep ? 'max-w-5xl' : 'max-w-120'"
    @submit.prevent="submit"
  >
    <div class="w-full max-w-120 mx-auto mb-8">
      <h1 class="text-center! animate-enter">
        {{ t('auth.courses.title_creation') }}
      </h1>
      <!-- Keyed, so the next step's description enters like the page did. -->
      <p
        :key="description"
        class="text-center m-0! animate-enter"
        :style="{
          '--enter-delay': entranceDelay(DESCRIPTION_ENTRANCE_ORDER),
        }"
      >
        {{ description }}
      </p>
    </div>

    <BaseFormContent class="flex-1" fill :error="error">
      <div v-if="loading" class="flex justify-center">
        <BaseSpinner />
      </div>

      <div
        v-else
        :key="step"
        class="flex flex-1 flex-col animate-enter"
        :style="{ '--enter-delay': entranceDelay(CONTENT_ENTRANCE_ORDER) }"
      >
        <div v-if="isLessonStep" class="flex flex-col gap-4">
          <CourseSetupStatus :open-subject-names="openSubjectNames" />
          <CourseSetupSchedule
            :lessons="setupLessons"
            :config="scheduleConfig"
            :states="resolution.states"
            :can-toggle="canToggleCourse"
            @toggle="toggleCourse"
          />
        </div>

        <CourseLevelPicker
          v-else-if="isAbitur"
          v-model="levels"
          :subjects="levelChoiceSubjects"
          :options="levelOptions"
        />

        <BaseEmptyState v-else-if="!hasCourseSubjects" class="flex-1">
          {{ t('auth.courses.none_offered') }}
        </BaseEmptyState>

        <div v-else class="flex flex-col gap-5">
          <BaseFormGroup
            v-for="subject in subjectStore.requiredCourseSubjects"
            :id="subject.id"
            :key="subject.id"
          >
            <BaseLabel :for="subject.id">{{
              translatedName(subject.name)
            }}</BaseLabel>
            <BaseSelect
              :id="subject.id"
              :model-value="selections[subject.id] ?? ''"
              :options="optionsForSubject(subject, false)"
              @update:model-value="(v) => (selections[subject.id] = v)"
            />
          </BaseFormGroup>

          <BaseFormGroup
            v-for="subject in subjectStore.optionalCourseSubjects"
            :id="subject.id"
            :key="subject.id"
          >
            <BaseLabel :for="subject.id">{{
              translatedName(subject.name)
            }}</BaseLabel>
            <BaseSelect
              :id="subject.id"
              :model-value="selections[subject.id] ?? ''"
              :options="optionsForSubject(subject, true)"
              @update:model-value="(v) => (selections[subject.id] = v)"
            />
          </BaseFormGroup>
        </div>
      </div>
    </BaseFormContent>

    <BasePageActions
      class="max-w-120 mx-auto mt-12 animate-enter"
      :style="{ '--enter-delay': entranceDelay(ACTIONS_ENTRANCE_ORDER) }"
    >
      <BaseButton
        type="submit"
        variant="action"
        class="w-full"
        :loading="saving"
        :disabled="saving || loading || hasOpenLessons"
      >
        {{ submitLabel }}
      </BaseButton>

      <template #secondary>
        <BaseButton
          v-if="isLessonStep && hasLevelChoices"
          type="button"
          surface
          variant="ghost"
          class="w-full"
          :disabled="saving"
          @click="goBack"
        >
          {{ t('common.buttons.back') }}
        </BaseButton>

        <BaseButton
          type="button"
          surface
          variant="ghost"
          class="w-full"
          :disabled="saving"
          @click="skip"
        >
          {{ t('common.buttons.skip') }}
        </BaseButton>
      </template>
    </BasePageActions>
  </form>
</template>
