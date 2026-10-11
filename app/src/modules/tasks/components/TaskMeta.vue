<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatSubjectDisplay } from '@/modules/courses/utils/subjectLabels';
import { useIsPhoneViewport } from '@/common/composables/useViewport';
import type { Task } from '@/modules/tasks/types';
import { formatDueDate } from '@/modules/tasks/utils/dueDate';
import { useImpliedCourse } from '@/modules/courses/composables/useImpliedCourse';

const props = defineProps<{
  item: Task;
  /** Redundant under a tab that holds a single type. */
  showType: boolean;
}>();

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const te = i18n.te.bind(i18n);

const courseIsImplied = useImpliedCourse(() => props.item);
const leadingParts = computed(() => [
  formatSubjectDisplay(
    props.item.subjectName,
    courseIsImplied.value ? null : props.item.courseName,
    t,
    te,
  ),
  ...(props.showType ? [t(`tasks.list.types.${props.item.type}`)] : []),
]);
const isPhoneViewport = useIsPhoneViewport();
const dueDate = computed(() =>
  formatDueDate(
    new Date(props.item.dueDate),
    i18n.locale.value,
    isPhoneViewport.value ? 'short' : 'long',
  ),
);
</script>

<template>
  <div class="text-on-ghost-muted flex justify-between gap-2 text-base">
    <span class="min-w-0 truncate">{{ leadingParts.join(' • ') }}</span>
    <span class="shrink-0">{{ dueDate }}</span>
  </div>
</template>
