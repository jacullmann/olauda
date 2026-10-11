<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Plus } from '@lucide/vue';
import type { Subject } from '@/modules/courses/stores/useSubjectStore';
import type { CourseLevel } from '@/modules/courses/utils/courseLevels';
import {
  normalizeSubjectCategory,
  SUBJECT_CATEGORIES,
  type SubjectCategory,
} from '@/modules/courses/types';
import { subjectLabel } from '@/modules/courses/utils/subjectLabels';
import { haptic } from '@/common/utils/haptics';

type TakenLevel = Exclude<CourseLevel, 'no'>;
type ColumnLevel = (typeof COLUMNS)[number];

/**
 * A subject offering more than one level gets a chip per level. One with a
 * single level besides dropping it is only taken or not, so its chip is a
 * plain switch: naming the level would tell the member nothing.
 */
type LevelCell =
  { kind: 'level'; level: ColumnLevel } | { kind: 'toggle'; level: TakenLevel };

const COLUMNS = ['gk', 'lk'] as const;

const props = defineProps<{
  subjects: Subject[];
  options: ReadonlyMap<string, CourseLevel[]>;
}>();

const levels = defineModel<Record<string, CourseLevel | null>>({
  required: true,
});

const i18n = useI18n();
const { t } = i18n;
const te = i18n.te.bind(i18n);

const LEVEL_LABEL_KEYS: Record<ColumnLevel, string> = {
  gk: 'groups.settings.subjects.course_types_short.gk',
  lk: 'groups.settings.subjects.course_types_short.lk',
};

const sections = computed(() =>
  SUBJECT_CATEGORIES.abitur
    .map((category) => ({
      category,
      subjects: props.subjects.filter(
        (subject) =>
          normalizeSubjectCategory(subject.category, 'abitur') === category,
      ),
    }))
    .filter((section) => section.subjects.length > 0),
);

/**
 * GK and LK keep their own column on every row, so the eye can run down
 * either one; a switch takes both, keeping every row's controls one width.
 */
function cellsOf(subjectId: string): (LevelCell | null)[] {
  const offered = props.options.get(subjectId) ?? [];
  const taken = offered.filter((level) => level !== 'no');
  if (taken.length === 1) return [{ kind: 'toggle', level: taken[0]! }];
  return COLUMNS.map((level) =>
    offered.includes(level) ? { kind: 'level', level } : null,
  );
}

const canDrop = (subjectId: string) =>
  props.options.get(subjectId)?.includes('no') ?? false;

const isTaken = (subjectId: string) => {
  const level = levels.value[subjectId];
  return level != null && level !== 'no';
};

function toggle(subjectId: string, level: TakenLevel) {
  const selected = levels.value[subjectId] === level;
  if (selected && !canDrop(subjectId)) return;

  levels.value = { ...levels.value, [subjectId]: selected ? 'no' : level };
  haptic();
}

function sectionTitle(category: SubjectCategory) {
  return t(`auth.courses.level_sections.${category}`);
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <section
      v-for="section in sections"
      :key="section.category"
      :aria-labelledby="`level-section-${section.category}`"
    >
      <h3 :id="`level-section-${section.category}`">
        {{ sectionTitle(section.category) }}
      </h3>

      <ul class="flex flex-col m-0 p-0 list-none divide-y divide-ghost-border">
        <li
          v-for="subject in section.subjects"
          :key="subject.id"
          role="group"
          :aria-labelledby="`level-${subject.id}`"
          class="flex items-center justify-between gap-4 py-2"
        >
          <span
            :id="`level-${subject.id}`"
            class="min-w-0 truncate transition-hover"
            :class="
              isTaken(subject.id) ? 'text-on-ghost' : 'text-on-ghost-muted'
            "
          >
            {{ subjectLabel(subject.name, t, te) }}
          </span>

          <div
            class="grid shrink-0 grid-cols-[repeat(2,--spacing(14))] gap-1.5"
          >
            <template
              v-for="(cell, index) in cellsOf(subject.id)"
              :key="cell?.level ?? index"
            >
              <button
                v-if="cell"
                type="button"
                class="relative flex h-9 items-center justify-center rounded-full text-sm font-medium outline-none transition-hover touch-target after:min-h-12 after:min-w-12 focus-visible:ring-2 focus-visible:ring-focus"
                :class="[
                  cell.kind === 'toggle' && 'col-span-2',
                  levels[subject.id] === cell.level
                    ? [
                        'bg-action text-on-action',
                        !canDrop(subject.id) && 'cursor-default',
                      ]
                    : 'cursor-pointer bg-ghost-hover text-on-ghost-muted hover:text-on-ghost',
                ]"
                :aria-labelledby="
                  cell.kind === 'toggle' ? `level-${subject.id}` : undefined
                "
                :aria-pressed="levels[subject.id] === cell.level"
                @click="toggle(subject.id, cell.level)"
              >
                <span
                  v-if="cell.kind === 'toggle'"
                  class="grid *:col-start-1 *:row-start-1 *:size-4 *:transition-[opacity,scale] *:duration-200 *:ease-out motion-reduce:*:transition-none"
                  aria-hidden="true"
                >
                  <Plus
                    :stroke-width="2.25"
                    :class="
                      levels[subject.id] === cell.level
                        ? 'scale-50 opacity-0'
                        : 'scale-100 opacity-100'
                    "
                  />
                  <Check
                    :stroke-width="2.75"
                    :class="
                      levels[subject.id] === cell.level
                        ? 'scale-100 opacity-100'
                        : 'scale-50 opacity-0'
                    "
                  />
                </span>
                <template v-else>{{
                  t(LEVEL_LABEL_KEYS[cell.level])
                }}</template>
              </button>
              <span v-else aria-hidden="true"></span>
            </template>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
