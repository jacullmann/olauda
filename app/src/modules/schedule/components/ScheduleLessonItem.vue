<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLongPress } from '@/common/composables/useLongPress';
import { useImpliedCourse } from '@/modules/courses/composables/useImpliedCourse';
import type { Lesson } from '@/modules/schedule/types';
import { Check } from '@lucide/vue';

const emit = defineEmits<{
  (e: 'select', lesson: Lesson, event?: MouseEvent): void;
  (e: 'contextmenu', lesson: Lesson, event: UIEvent): void;
}>();

const props = withDefaults(
  defineProps<{
    lesson: Lesson;
    hasBorder: boolean;
    isClickable?: boolean;
    isSelected?: boolean;
    singleSelect?: boolean;
    hasContextMenu?: boolean;
    periodLabel?: string;
    getDisplayName: (lesson: Lesson) => string;
  }>(),
  {
    isClickable: false,
    isSelected: false,
    singleSelect: false,
    hasContextMenu: false,
    periodLabel: undefined,
  },
);

const { t } = useI18n();

const { handlers } = useLongPress(
  (event) => emit('contextmenu', props.lesson, event),
  { grow: '.js-lesson-card' },
);

function onClick(event?: MouseEvent) {
  if (!props.isClickable) return;

  emit('select', props.lesson, event);
}

const strongText = computed(() => [
  props.isSelected && !props.singleSelect ? 'text-on-action' : 'text-on-ghost',
  'group-[.highlight-active]:text-on-action!',
]);

const mutedText = computed(() => [
  props.isSelected && !props.singleSelect
    ? 'text-on-action-muted'
    : 'text-on-ghost-muted',
  'group-[.highlight-active]:text-on-action-muted!',
]);

/* A cancelled lesson shows only that it is cancelled, not what else changed. */
const shownOriginal = computed(() =>
  props.lesson.cancelled ? undefined : props.lesson._original,
);

const originalName = computed(() => {
  if (!shownOriginal.value) return undefined;
  const name = props.getDisplayName(shownOriginal.value);
  return name === props.getDisplayName(props.lesson) ? undefined : name;
});

const courseIsImplied = useImpliedCourse(() => ({
  subjectId: props.lesson.subjectId,
  courseId: props.lesson.courseId,
}));

const roomChanged = computed(
  () => !!shownOriginal.value && props.lesson.room !== shownOriginal.value.room,
);

const showsRoom = computed(
  () => Boolean(props.lesson.room) || roomChanged.value,
);
</script>

<template>
  <div
    class="js-lesson-card flex-1 flex flex-col justify-start h-full max-xs:px-2.5 max-xs:py-1.5 px-2 py-1 select-none"
    :class="[
      hasBorder
        ? 'border-b border-ghost-border group-[.highlight-active]:border-on-ghost-muted!'
        : '',
      isClickable
        ? 'cursor-pointer transition-colors duration-150 hover:bg-ghost-hover'
        : '',
      props.isSelected
        ? props.singleSelect
          ? 'bg-surface-highlight'
          : 'bg-action! text-on-action!'
        : '',
      hasContextMenu ? 'long-press-target' : '',
    ]"
    :role="isClickable ? 'button' : undefined"
    :tabindex="isClickable ? 0 : undefined"
    :aria-pressed="isClickable ? isSelected : undefined"
    v-on="hasContextMenu ? handlers : {}"
    @click.stop="onClick"
    @keydown.enter.space.self.prevent="onClick()"
  >
    <div>
      <div
        class="font-bold text-base whitespace-nowrap overflow-hidden text-ellipsis flex items-center"
        :class="lesson.cancelled ? mutedText : strongText"
      >
        <span class="flex-1 min-w-0 truncate">
          <template v-if="originalName">
            <span class="line-through font-normal mr-1" :class="mutedText">
              {{ originalName }}
            </span>
            <span class="font-bold" :class="strongText">
              {{ getDisplayName(lesson) }}
            </span>
          </template>
          <template v-else>
            {{ getDisplayName(lesson) }}
          </template>
        </span>

        <span
          v-if="lesson.courseCount && lesson.courseCount > 1"
          class="text-sm shrink-0 inline-block px-2.5 py-0.5 ml-2 rounded-full font-semibold max-w-full group-[.highlight-active]:bg-on-action/15! group-[.highlight-active]:text-on-action-muted!"
          :class="
            isSelected && !singleSelect
              ? 'text-on-action-muted bg-on-action/15'
              : 'bg-ghost-hover text-on-ghost-muted'
          "
        >
          {{ lesson.courseCount }}
        </span>
        <span
          v-else-if="lesson.courseName && !courseIsImplied"
          class="font-normal truncate ml-1 min-w-0 max-w-[55%]"
          :class="mutedText"
        >
          {{ lesson.courseName }}
        </span>
      </div>

      <div
        v-if="lesson.cancelled"
        class="text-danger font-bold text-base group-[.highlight-active]:text-danger!"
      >
        {{ t('schedule.cancelled') }}
      </div>

      <div
        v-if="showsRoom || periodLabel"
        class="flex justify-between text-sm"
        :class="mutedText"
      >
        <span v-if="showsRoom" class="inline-flex gap-1 items-center">
          <template v-if="roomChanged">
            <span class="line-through font-normal mr-1" :class="mutedText">
              {{ shownOriginal?.room }}
            </span>
            <span class="font-bold" :class="strongText">
              {{ lesson.room }}
            </span>
          </template>
          <template v-else>
            {{ lesson.room }}
          </template>
        </span>
        <span v-if="periodLabel" class="shrink-0 ml-auto pl-2">
          {{ periodLabel }}
        </span>
        <Check
          v-if="isSelected && singleSelect"
          :size="20"
          :stroke-width="3"
          class="text-accent"
        />
      </div>
    </div>
  </div>
</template>
