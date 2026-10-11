<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  ref,
  useTemplateRef,
  watch,
} from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useIntersectionObserver } from '@vueuse/core';
import { useDismissibleNotice } from '@/modules/account/composables/useDismissibleNotice';
import { Plus, ListFilter } from '@lucide/vue';

import { useTasks } from '@/modules/tasks/composables/useTasks';
import {
  holdPendingEntrances,
  vEntranceStart,
} from '@/common/composables/useSkeletonHandoff';
import { useCardEntrance } from '@/common/composables/useCardEntrance';
import { useDueSections } from '@/modules/tasks/composables/useDueSections';
import { useGroups } from '@/modules/groups/composables/useGroups';

import TaskSkeleton from '@/modules/tasks/components/TaskSkeleton.vue';
import TaskCard from '@/modules/tasks/components/TaskCard.vue';
import CoursePersonalizedViewNotice from '@/modules/courses/components/CoursePersonalizedViewNotice.vue';

import type { ItemType } from '@/modules/tasks/types';
import { entranceDelay, hasSettledEntrance } from '@/common/utils/entrance';
import { collapseHeight, collapseTransition } from '@/common/utils/collapse';

const showFilterModal = ref(false);

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const tm = i18n.tm.bind(i18n);

const { activeGroupDaltonEnabled } = useGroups();

const tabItems = computed(() => [
  { id: 'all', label: t('tasks.list.tabs.all') },
  { id: 'homework', label: t('tasks.list.tabs.homework') },
  ...(activeGroupDaltonEnabled.value
    ? [{ id: 'dalton', label: t('tasks.list.tabs.dalton') }]
    : []),
  { id: 'exam', label: t('tasks.list.tabs.exams') },
]);

const {
  user,
  loading,
  initialLoad,
  subjectFilter,
  showPersonalized,
  hiddenByCourses,
  showOldEntries,
  hideChecked,
  visibleCount,
  limitedItems,
  hasMoreItems,
  filteredItems,
  tab,
  openMenuId,
  showMore,
  onMenuAction,
  archiveItem,
  dismissedItems,
  useListTransitions,
  canDelete,
  canManageNotes,
  canUploadImages,
  goTab,
  isChecked,
  toggleCheck,
  isPinned,
  triggerImageDrop,
  subjectOptions,
  resetFilters,
  openCreateForm,
  listLoadError,
  reloadList,
} = useTasks();

const visibleItems = computed(() =>
  limitedItems.value.filter((item) => !dismissedItems.has(item.id)),
);

const { rows } = useDueSections(visibleItems, isPinned);

const hasActiveFilters = computed(
  () => subjectFilter.value !== '' || showOldEntries.value || hideChecked.value,
);

const personalizedNotice = useDismissibleNotice('personalizedTasks');

const showPersonalizedNotice = computed(
  () =>
    !personalizedNotice.isDismissed.value &&
    showPersonalized.value &&
    hiddenByCourses.value > 0 &&
    !initialLoad.value,
);

// The Dalton tab disappears with the setting, also for a link that opened it.
watch(
  [activeGroupDaltonEnabled, tab],
  ([daltonEnabled, activeTab]) => {
    if (!daltonEnabled && activeTab === 'dalton') goTab('all');
  },
  { immediate: true },
);

// Kept alive while a task is open, so the page is where it was left on return.
// Taken before leaving: once the task replaced the list, the page is too short
// to still be scrolled that far.
let scrollTop = 0;
onBeforeRouteLeave(() => {
  scrollTop = window.scrollY;
});
onActivated(() => {
  window.scrollTo({ top: scrollTop, behavior: 'instant' });
});

const showSkeleton = computed(() => loading.value && initialLoad.value);

/** The header, then the tabs and filter beside them, then the list. */
const TABS_ENTRANCE_ORDER = 1;
const FILTER_ENTRANCE_ORDER = 2;
const LIST_ENTRANCE_ORDER = 3;

// Stays in the flow while it folds away, so the rows below follow it up.
function collapseLeavingRow(el: Element, done: () => void) {
  if (!useListTransitions.value) done();
  else collapseHeight(el as HTMLElement, done);
}

// A heading that becomes the first sheds its spacing in step with the section
// collapsing above it, so the rows below move up along one curve. Off while
// the list swaps wholesale, as between tabs, where nothing collapses.
const headingSpacingStyle = computed(() =>
  useListTransitions.value
    ? { transition: collapseTransition('padding-top') }
    : undefined,
);

// Behind the skeleton the list still sorts itself as checks and pins load.
const {
  entranceStart: cardEntranceStart,
  entranceStartOf: cardEntranceStartOf,
  isEntering: isCardEntering,
  entranceStyle: cardEntranceStyle,
  hasSettled: hasCardEntranceSettled,
  handleEntranceEnd: handleCardAnimationEnd,
  showWithoutEntrance: showCardsWithoutEntrance,
  settleAll: settleCardEntrance,
} = useCardEntrance(
  computed(() => visibleItems.value.map((item) => item.id)),
  showSkeleton,
  LIST_ENTRANCE_ORDER,
);

// Every task is loaded already, so the next page is only rendered once the
// list's end comes within a screen's height, before it is reached. While the
// first cards still cascade in, a page fills a tall screen and joins them.
const pageEnd = useTemplateRef<HTMLElement>('pageEnd');
useIntersectionObserver(
  pageEnd,
  ([entry]) => {
    if (!entry?.isIntersecting) return;
    const revealedIds = showMore().map((item) => item.id);
    if (hasCardEntranceSettled.value) showCardsWithoutEntrance(revealedIds);
  },
  { rootMargin: '0px 0px 100% 0px' },
);

const emptyStateEntered = ref(false);

function handleEmptyStateAnimationEnd(event: AnimationEvent) {
  if (hasSettledEntrance(event)) emptyStateEntered.value = true;
}

// Returning puts the page's nodes back into the document, which would restart
// their entrance, so it only plays the first time the page is shown, also for
// whatever had not settled yet when a task was opened.
const hasEntered = ref(false);
onDeactivated(() => {
  hasEntered.value = true;
  emptyStateEntered.value = true;
  settleCardEntrance();
});
</script>

<template>
  <div class="flex flex-1 flex-col p-4">
    <div :class="{ 'animate-enter': !hasEntered }">
      <BasePageHeader>
        <template #info>
          <BaseInfoButton
            :tooltip="t('tasks.list.infopop.tooltip')"
            :title="t('tasks.list.title')"
          >
            <p>{{ t('tasks.list.infopop.description') }}</p>
            <template
              v-for="(section, index) in tm('tasks.list.infopop.sections')"
              :key="index"
            >
              <!-- eslint-disable-next-line vue/no-v-html -- bundled translation markup, not user input -->
              <h3 v-html="section.title"></h3>
              <!-- eslint-disable-next-line vue/no-v-html -- bundled translation markup, not user input -->
              <p v-html="section.text"></p>
            </template>
          </BaseInfoButton>
        </template>

        <template #action>
          <BaseRow class="flex-nowrap!">
            <!-- Below md the filter row under the tabs would cost a whole line
                 for one button, so the button joins the header actions instead.
                 There is no room for its label there, and a tooltip never opens
                 on a touch device, so the active state has to read from the
                 button itself: it stays filled while a filter is on. -->
            <BaseTooltip
              :content="t('tasks.list.filter')"
              placement="bottom"
              class="md:hidden"
            >
              <BaseButton
                variant="ghost"
                :surface="hasActiveFilters"
                :aria-label="
                  hasActiveFilters
                    ? t('tasks.list.filter_active')
                    : t('tasks.list.filter')
                "
                :icon="ListFilter"
                @click="showFilterModal = true"
              />
            </BaseTooltip>

            <BaseTooltip :content="t('common.sidebar.task')" placement="bottom">
              <BaseButton
                variant="action"
                :aria-label="t('tasks.list.task_form.new_task')"
                :icon="Plus"
                icon-classes="size-6"
                @click="openCreateForm"
              />
            </BaseTooltip>
          </BaseRow>
        </template>
      </BasePageHeader>
    </div>

    <div class="flex gap-x-2 md:justify-between">
      <div
        class="min-w-0 grow"
        :class="{ 'animate-enter': !hasEntered }"
        :style="{ '--enter-delay': entranceDelay(TABS_ENTRANCE_ORDER) }"
      >
        <BaseTabs
          :items="tabItems"
          :active-id="tab"
          @change="(id) => goTab(id as ItemType)"
        />
      </div>

      <div
        class="max-md:hidden"
        :class="{ 'animate-enter': !hasEntered }"
        :style="{ '--enter-delay': entranceDelay(FILTER_ENTRANCE_ORDER) }"
      >
        <BaseRow>
          <BaseButton
            variant="ghost"
            :icon="ListFilter"
            :surface="hasActiveFilters"
            @click="showFilterModal = true"
          >
            {{ t('tasks.list.filter') }}
          </BaseButton>
        </BaseRow>
      </div>
    </div>

    <CoursePersonalizedViewNotice
      :show="showPersonalizedNotice"
      :entrance="!hasEntered"
      class="mt-4 w-full max-w-192 mx-auto"
      @dismiss="personalizedNotice.dismiss"
    />

    <!-- Tightens in step with the notice opening above it. -->
    <div
      class="relative flex w-full max-w-192 flex-1 flex-col gap-3 mx-auto transition-[margin-top] duration-500 ease-(--ease-settle)"
      :class="showPersonalizedNotice ? 'mt-3' : 'mt-8'"
    >
      <!-- Taken out of the flow while it fades, so the cards arriving in its
           place overlap it instead of waiting below it. -->
      <Transition
        leave-active-class="absolute inset-x-0 top-0 transition-opacity duration-300 ease-out"
        leave-to-class="opacity-0"
        @before-leave="holdPendingEntrances"
      >
        <TaskSkeleton
          v-if="showSkeleton"
          :entrance-order="LIST_ENTRANCE_ORDER"
          :entrance-start="cardEntranceStart"
        />
      </Transition>

      <TransitionGroup
        v-if="!showSkeleton && !listLoadError"
        :css="useListTransitions"
        name="task-list"
        tag="div"
        class="flex flex-col relative max-md:-mx-4"
        @leave="collapseLeavingRow"
      >
        <!-- A heading or separator is its own row with its own key, so it
             folds away on its own when its task leaves or moves into another
             section. One element per fragment: the fragment's key prefixes the
             key Vue gives each branch, which stays unique that way. -->
        <template v-for="row in rows" :key="row.key">
          <h3
            v-if="row.kind === 'heading'"
            v-entrance-start="cardEntranceStartOf(row.taskId)"
            class="px-4 md:px-3 pb-2"
            :class="{
              'pt-6': !row.isFirst,
              'animate-enter': isCardEntering(row.taskId),
            }"
            :style="[cardEntranceStyle(row.taskId), headingSpacingStyle]"
          >
            {{ row.label }}
          </h3>
          <div
            v-else-if="row.kind === 'separator'"
            v-entrance-start="cardEntranceStartOf(row.taskId)"
            class="separator ml-11.5 md:ml-10.5 mr-4"
            :class="{ 'animate-enter': isCardEntering(row.taskId) }"
            :style="cardEntranceStyle(row.taskId)"
          ></div>
          <TaskCard
            v-else
            v-entrance-start="cardEntranceStartOf(row.task.id)"
            :class="{ 'animate-enter': isCardEntering(row.task.id) }"
            :style="cardEntranceStyle(row.task.id)"
            :item="row.task"
            :show-type="tab === 'all'"
            :is-archive-view="showOldEntries"
            :is-checked="isChecked(row.task.id)"
            :is-pinned="isPinned(row.task.id)"
            :is-menu-open="openMenuId === row.task.id"
            :can-check="!!user"
            :can-upload-images="canUploadImages"
            :can-add-note="canManageNotes && !row.task.editorNote"
            :can-delete="canDelete(row.task)"
            @toggle-check="toggleCheck(row.task)"
            @swipe="archiveItem(row.task)"
            @menu-action="(action) => onMenuAction(action, row.task)"
            @open-menu="openMenuId = row.task.id"
            @close-menu="openMenuId = null"
            @image-drop="(files) => triggerImageDrop(row.task, files)"
            @animationend="handleCardAnimationEnd($event, row.task.id)"
          />
        </template>
      </TransitionGroup>

      <BaseEmptyState
        v-if="!loading && listLoadError"
        class="flex-1 animate-enter"
        :primary-action="() => void reloadList()"
      >
        {{ t('tasks.list.tasks.view.list_load_failed') }}
        <template #message>{{
          t('tasks.list.tasks.view.load_failed_message')
        }}</template>
        <template #primary-action-label>{{
          t('common.buttons.retry')
        }}</template>
      </BaseEmptyState>

      <BaseEmptyState
        v-else-if="!loading && !limitedItems.length"
        class="flex-1"
        :class="{ 'animate-enter': !emptyStateEntered }"
        :primary-action="openCreateForm"
        :secondary-action="resetFilters"
        @animationend="handleEmptyStateAnimationEnd"
      >
        {{ t('tasks.list.tasks.view.no_tasks') }}
        <template #message>{{
          filteredItems.length
            ? t('tasks.list.tasks.view.no_tasks_in_view_message')
            : t('tasks.list.tasks.view.no_tasks_message')
        }}</template>
        <template #primary-action-label>{{
          t('tasks.list.create_task')
        }}</template>
        <template #secondary-action-label>{{
          t('tasks.list.reset_filters')
        }}</template>
      </BaseEmptyState>

      <!-- Replaced with every page: an observer only reports changes, and the
           end may still be in range after a page too short to reach past it.
           Out of the flow, so the list's gap does not open beneath it. -->
      <div
        v-if="hasMoreItems && !showSkeleton"
        ref="pageEnd"
        :key="visibleCount"
        aria-hidden="true"
        class="absolute inset-x-0 bottom-0"
      ></div>
    </div>

    <BaseModal :open="showFilterModal" sheet @cancel="showFilterModal = false">
      <template #title>
        {{ t('tasks.list.filter') }}
      </template>

      <template #content>
        <div class="flex flex-col -mx-4">
          <BaseList
            v-model="subjectFilter"
            select
            :options="subjectOptions"
            :title="t('tasks.list.task_form.subject')"
          >
            <template #label>
              {{ t('tasks.list.task_form.subject') }}
            </template>
          </BaseList>

          <BaseList v-model:checked="showOldEntries" toggle>
            <template #label>
              {{ t('tasks.list.archive.archive') }}
            </template>
          </BaseList>

          <BaseList v-model:checked="hideChecked" toggle :separator="false">
            <template #label>
              {{ t('tasks.list.hide_checked') }}
            </template>
          </BaseList>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.task-list-leave-active {
  animation: none !important;
}

.task-list-move {
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
</style>
