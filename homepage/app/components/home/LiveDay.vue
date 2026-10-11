<script setup lang="ts">
import { ListTodo, NotebookPen } from '@lucide/vue';
import type { DayRow } from '~/composables/useLiveDay';
import { DEMO_WEEK, formatClock, type DemoLesson } from '~/utils/demoWeek';

const { t, tm, rt, locale, locales } = useI18n();
const { day, chosenDay, live, isLiveDay, rows, now, nowLine, highlightedKey } = useLiveDay();

const longDays = computed(() => (tm('days.long') as string[]).map((day) => rt(day)));
const shortDays = computed(() => (tm('days.short') as string[]).map((day) => rt(day)));

const dayOptions = computed(() =>
  DEMO_WEEK.map((_, index) => ({
    value: index,
    label: shortDays.value[index]!,
    ariaLabel: longDays.value[index],
    marked: live.value?.day === index,
  })),
);

/** Picking the live day hands control back to the clock. */
const selectedDay = computed({
  get: () => day.value,
  set: (value: number) => {
    chosenDay.value = value === live.value?.day ? null : value;
  },
});

const language = computed(
  () => locales.value.find((option) => option.code === locale.value)?.language ?? 'en-US',
);

const heading = computed(() => {
  if (!isLiveDay.value || !live.value) return { title: longDays.value[day.value], date: null };
  const date = new Intl.DateTimeFormat(language.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(live.value.date);
  if (live.value.relation === 'later') return { title: date, date: null };
  return { title: t(`home.day.${live.value.relation}`), date };
});

const isReady = ref(false);
const hasSwitched = ref(false);
onMounted(() => {
  isReady.value = true;
});
watch(day, () => {
  hasSwitched.value = true;
});

const enterDelay = (index: number) => `${hasSwitched.value ? index * 35 : 120 + index * 70}ms`;
const lineDelay = computed(() => (hasSwitched.value ? '0ms' : `${220 + rows.value.length * 70}ms`));

const periodLabel = (lesson: DemoLesson) =>
  lesson.firstPeriod === lesson.lastPeriod
    ? String(lesson.firstPeriod)
    : `${lesson.firstPeriod}–${lesson.lastPeriod}`;

const roomLabel = (room: string) =>
  room === 'gym' ? t('home.day.gym') : t('home.day.room', { room });

const breakLabel = (row: DayRow) => {
  const minutesNow = nowLine.value?.key === row.key && now.value ? now.value : null;
  if (!minutesNow) return t('home.day.break', { minutes: row.end - row.start });
  const elapsed = minutesNow.getHours() * 60 + minutesNow.getMinutes() - row.start;
  return t('home.day.break_left', { minutes: row.end - row.start - elapsed });
};

const clock = computed(() =>
  now.value ? formatClock(now.value.getHours() * 60 + now.value.getMinutes()) : '',
);
</script>

<template>
  <section :aria-label="t('home.day.label')">
    <div
      class="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-on-ghost pb-4"
    >
      <p class="flex flex-wrap items-baseline gap-x-3">
        <span class="font-display text-subtitle font-bold">{{ heading.title }}</span>
        <span v-if="heading.date" class="text-on-ghost-muted">{{ heading.date }}</span>
      </p>
      <SegmentedControl
        v-model="selectedDay"
        :options="dayOptions"
        :label="t('home.day.pick_day')"
      />
    </div>

    <ol class="mt-1">
      <li
        v-for="(row, index) in rows"
        :key="`${day}-${row.key}`"
        class="relative -mx-3 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-3 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-ghost-border first:before:hidden sm:-mx-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-5 sm:before:inset-x-5 [.is-highlighted+&]:before:hidden"
        :class="[
          row.kind === 'lesson'
            ? 'py-[clamp(0.875rem,0.45rem+1.3vw,1.5rem)]'
            : 'py-2.5 text-label text-on-ghost-muted',
          row.key === highlightedKey && 'is-highlighted bg-action text-on-action before:hidden',
          isReady ? 'animate-enter' : 'js:animate-pending',
        ]"
        :style="{ '--enter-delay': enterDelay(index) }"
      >
        <template v-if="row.kind === 'lesson'">
          <div
            class="flex flex-col gap-0.5 self-start pt-[0.35em] sm:pt-[0.6em]"
            :class="nowLine?.key === row.key && 'invisible'"
          >
            <span class="tabular font-display text-lg/5 font-bold">{{
              periodLabel(row.lesson)
            }}</span>
            <span
              class="tabular text-label"
              :class="row.key === highlightedKey ? 'text-on-action-muted' : 'text-on-ghost-muted'"
            >
              {{ formatClock(row.start) }}
            </span>
          </div>

          <div class="flex min-w-0 flex-col gap-2">
            <span
              class="font-display text-lesson"
              :class="[
                row.key === highlightedKey ? 'font-bold' : 'font-medium',
                row.lesson.change?.kind === 'canceled' &&
                  'text-on-ghost-subtle line-through decoration-danger decoration-[0.07em]',
              ]"
            >
              {{ t(`subjects.${row.lesson.subject}`) }}
            </span>
            <span
              v-if="row.lesson.change?.kind === 'substitute'"
              class="text-sm"
              :class="row.key === highlightedKey ? 'text-on-action-muted' : 'text-on-ghost-muted'"
            >
              <i18n-t keypath="home.day.instead_of" scope="global">
                <template #value>
                  <s>{{ t(`subjects.${row.lesson.change.previousSubject}`) }}</s>
                </template>
              </i18n-t>
            </span>
            <span
              v-if="row.lesson.task"
              class="flex items-center gap-1.5 text-sm"
              :class="row.key === highlightedKey ? 'text-on-action-muted' : 'text-on-ghost-muted'"
            >
              <component
                :is="row.lesson.task.isExam ? NotebookPen : ListTodo"
                :size="16"
                class="shrink-0"
                aria-hidden="true"
              />
              {{
                t(row.lesson.task.isExam ? 'home.day.exam' : 'home.day.homework', {
                  title: t(`home.tasks.${row.lesson.task.key}`),
                })
              }}
            </span>
          </div>

          <div
            class="flex flex-col items-end gap-1 self-start pt-[0.45em] text-right sm:pt-[0.8em]"
          >
            <span
              v-if="row.key === highlightedKey && isLiveDay"
              class="text-label font-medium text-on-action-muted"
            >
              {{
                nowLine?.key === row.key && nowLine.fraction > 0
                  ? t('home.day.now')
                  : t('home.day.next')
              }}
            </span>
            <span
              v-if="row.lesson.change?.kind === 'canceled'"
              class="text-sm font-medium text-danger"
            >
              {{ t('home.day.canceled') }}
            </span>
            <template v-else>
              <span class="tabular text-sm font-medium">{{ roomLabel(row.lesson.room) }}</span>
              <s
                v-if="row.lesson.change?.kind === 'room'"
                class="tabular text-sm"
                :class="row.key === highlightedKey ? 'text-on-action-muted' : 'text-on-ghost-muted'"
              >
                {{ row.lesson.change.previousRoom }}
              </s>
            </template>
          </div>
        </template>

        <span v-else class="col-start-2">{{ breakLabel(row) }}</span>

        <div
          v-if="nowLine?.key === row.key"
          class="pointer-events-none absolute inset-x-3 z-10 flex items-center sm:inset-x-5"
          :style="{ top: `${nowLine.fraction * 100}%` }"
        >
          <span
            class="tabular relative -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-label font-medium text-on-accent"
            :class="isReady && 'animate-enter'"
            :style="{ '--enter-delay': lineDelay }"
          >
            <span class="sr-only">{{ t('home.day.current_time') }}</span>
            {{ clock }}
          </span>
          <span
            aria-hidden="true"
            class="h-0.5 flex-1 -translate-y-1/2 origin-left bg-accent"
            :class="isReady && 'animate-now-line'"
            :style="{ animationDelay: lineDelay }"
          />
        </div>
      </li>
    </ol>

    <p class="mt-5 max-w-prose text-label text-on-ghost-muted">{{ t('home.day.caption') }}</p>
  </section>
</template>
