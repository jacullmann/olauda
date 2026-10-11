<script setup lang="ts">
import { Check, Lock, Pin } from '@lucide/vue';
import type { DemoSubject } from '~/utils/demoWeek';

type Scope = 'mine' | 'all';

interface SpecimenTask {
  key: 'essay' | 'test' | 'lab' | 'reading' | 'worksheet' | 'gift';
  subject?: DemoSubject;
  course?: string;
  /** Monday is 0, matching days.long. */
  due?: number;
  isMine: boolean;
  isPinned?: boolean;
  isPrivate?: boolean;
}

const { t, tm, rt } = useI18n();

const TASKS: readonly SpecimenTask[] = [
  { key: 'test', subject: 'maths', course: 'LK 1', due: 3, isMine: true, isPinned: true },
  { key: 'essay', subject: 'german', course: 'GK 2', due: 2, isMine: true },
  { key: 'lab', subject: 'chemistry', course: 'GK 1', due: 3, isMine: false },
  { key: 'reading', subject: 'english', course: 'LK 2', due: 4, isMine: true },
  { key: 'worksheet', subject: 'maths', course: 'GK 3', due: 4, isMine: false },
  { key: 'gift', isMine: true, isPrivate: true },
];

const scope = ref<Scope>('mine');
const done = ref(new Set<SpecimenTask['key']>(['essay']));

const scopeOptions = computed(() => [
  { value: 'mine' as const, label: t('home.specimen.only_mine') },
  { value: 'all' as const, label: t('home.specimen.all') },
]);

const visibleTasks = computed(() =>
  scope.value === 'mine' ? TASKS.filter((task) => task.isMine) : TASKS,
);
const hiddenCount = computed(() => TASKS.length - visibleTasks.value.length);

const longDays = computed(() => (tm('days.long') as string[]).map((day) => rt(day)));

const toggle = (key: SpecimenTask['key']) => {
  const next = new Set(done.value);
  if (!next.delete(key)) next.add(key);
  done.value = next;
};
</script>

<template>
  <figure
    class="rounded-3xl border border-ghost-border bg-surface p-2 shadow-input sm:p-3"
    :aria-label="t('home.specimen.label')"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 px-2 pt-2 pb-3 sm:px-3">
      <SegmentedControl v-model="scope" :options="scopeOptions" :label="t('home.specimen.label')" />
      <p
        class="text-label text-on-ghost-muted transition-opacity duration-200"
        :class="hiddenCount ? 'opacity-100' : 'opacity-0'"
        aria-live="polite"
      >
        {{ hiddenCount ? t('home.specimen.hidden', hiddenCount) : '' }}
      </p>
    </div>

    <TransitionGroup
      tag="ul"
      move-class="transition-transform duration-500 ease-settle"
      enter-active-class="transition-[opacity,filter] duration-300 ease-settle"
      enter-from-class="opacity-0 blur-[4px]"
      leave-active-class="absolute inset-x-0 transition-opacity duration-150"
      leave-to-class="opacity-0"
      class="relative"
    >
      <li
        v-for="task in visibleTasks"
        :key="task.key"
        class="group relative flex items-start gap-3 rounded-xl px-2 py-3 sm:px-3"
      >
        <label class="relative mt-0.75 flex size-4.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            class="peer absolute inset-0 cursor-pointer appearance-none rounded-sm border-2 border-on-ghost-muted transition-colors checked:border-action checked:bg-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            :checked="done.has(task.key)"
            :aria-label="
              t('home.specimen.mark_done', { title: t(`home.specimen.rows.${task.key}`) })
            "
            @change="toggle(task.key)"
          />
          <Check
            :size="14"
            :stroke-width="3"
            class="pointer-events-none relative m-auto scale-50 text-on-action opacity-0 transition-[scale,opacity] duration-250 ease-spring peer-checked:scale-100 peer-checked:opacity-100"
            aria-hidden="true"
          />
        </label>

        <div class="min-w-0 flex-1">
          <p
            class="flex items-center gap-1.5 truncate text-base/6 font-semibold transition-colors"
            :class="done.has(task.key) && 'text-on-ghost-subtle'"
          >
            <span class="truncate">{{ t(`home.specimen.rows.${task.key}`) }}</span>
            <Pin v-if="task.isPinned" :size="16" class="shrink-0" aria-hidden="true" />
          </p>
          <p class="flex justify-between gap-3 text-sm text-on-ghost-muted">
            <span v-if="task.isPrivate" class="flex items-center gap-1">
              <Lock :size="14" aria-hidden="true" />
              {{ t('home.specimen.private') }}
            </span>
            <span v-else class="truncate">
              {{ t(`subjects.${task.subject}`) }} • {{ task.course }}
            </span>
            <span v-if="task.due !== undefined" class="shrink-0">{{ longDays[task.due] }}</span>
          </p>
        </div>
        <span
          aria-hidden="true"
          class="absolute right-3 bottom-0 left-10.5 h-px bg-ghost-border group-last:hidden sm:left-11.5"
        />
      </li>
    </TransitionGroup>
  </figure>
</template>
