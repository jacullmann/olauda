<script setup lang="ts">
const { t } = useI18n();

const dayVisibility: Record<DemoDay['key'], string> = {
  mon: 'hidden lg:flex',
  tue: 'hidden sm:flex',
  wed: 'flex',
  thu: 'hidden sm:flex',
  fri: 'hidden lg:flex',
};

const periodBlocks = [demoPeriods.slice(0, 2), demoPeriods.slice(2, 4), demoPeriods.slice(4, 6)];

function isNow(day: DemoDay, blockIndex: number, periodIndex: number) {
  return day.key === demoToday && blockIndex === demoNow.block && periodIndex === demoNow.period;
}
</script>

<template>
  <figure class="m-0 flex" role="img" :aria-label="t('home.hero.timetable_label')">
    <div class="flex w-14 shrink-0 flex-col sm:w-20">
      <div class="h-12 border-b border-on-ghost" />
      <template v-for="(block, blockIndex) in periodBlocks" :key="blockIndex">
        <div
          v-for="period in block"
          :key="period.number"
          class="flex h-period flex-col gap-0.5 border-b border-ghost-border pt-2.5"
        >
          <span class="font-serif text-[1.375rem] leading-none lining-nums">{{
            period.number
          }}</span>
          <span class="tabular text-xs text-on-ghost-subtle">{{ period.start }}</span>
        </div>
        <div
          v-if="blockIndex < demoBreakMinutes.length"
          class="flex h-break items-center border-b border-ghost-border text-[0.6875rem] text-on-ghost-subtle"
        >
          {{ t('home.hero.break', { minutes: demoBreakMinutes[blockIndex] }) }}
        </div>
      </template>
    </div>

    <div
      v-for="day in demoWeek"
      :key="day.key"
      class="min-w-0 flex-1 flex-col border-l border-ghost-border"
      :class="[dayVisibility[day.key], day.key === demoToday && 'bg-tint']"
    >
      <div
        class="flex h-12 items-baseline gap-1.5 border-b border-on-ghost px-3"
        :class="day.key === demoToday ? 'text-on-ghost' : 'text-on-ghost-subtle'"
      >
        <span class="self-center text-sm font-semibold">{{ t(`home.days.${day.key}`) }}</span>
        <span class="tabular self-center text-sm">{{ day.date }}</span>
      </div>

      <template v-for="(block, blockIndex) in day.blocks" :key="blockIndex">
        <template v-for="(lesson, periodIndex) in block" :key="periodIndex">
          <div
            class="relative flex flex-col border-b border-ghost-border px-3 pt-2.5 pb-2"
            :class="[
              block.length === 1 ? 'h-double-period' : 'h-period',
              lesson?.cancelled && 'bg-(image:--pattern-void)',
            ]"
          >
            <template v-if="lesson">
              <span
                class="truncate text-sm font-medium"
                :class="lesson.cancelled && 'text-on-ghost-muted line-through decoration-danger'"
              >
                {{ t(`home.subjects.${lesson.subject}`) }}
              </span>

              <span v-if="lesson.cancelled" class="text-[0.8125rem] font-medium text-danger">
                {{ t('home.hero.cancelled') }}
              </span>
              <span v-else class="tabular flex gap-1.5 text-[0.8125rem] text-on-ghost-muted">
                <s v-if="lesson.movedTo" class="text-on-ghost-subtle">{{ lesson.room }}</s>
                <span :class="lesson.movedTo && 'font-semibold text-on-ghost'">
                  {{ lesson.movedTo ?? lesson.room }}
                </span>
              </span>

              <span v-if="lesson.substitute" class="mt-1 truncate text-[0.8125rem]">
                {{ t('home.hero.substitute') }}
              </span>

              <span
                v-if="lesson.task"
                class="mt-auto flex min-w-0 items-center gap-1.5 text-xs text-on-ghost-muted"
              >
                <span class="size-2.5 shrink-0 rounded-[2px] border border-current" />
                <span class="truncate">{{ t(`home.tasks.${lesson.task}`) }}</span>
              </span>
              <span
                v-if="lesson.exam"
                class="mt-auto text-[0.6875rem] font-semibold tracking-[0.08em] uppercase"
              >
                {{ t('home.hero.exam') }}
              </span>
            </template>

            <div
              v-if="isNow(day, blockIndex, periodIndex)"
              class="absolute inset-x-0 flex items-center"
              :style="{ top: `${demoNow.progress * 100}%` }"
            >
              <span class="-ml-1 size-2 shrink-0 rounded-full bg-accent" />
              <span class="h-[1.5px] flex-1 bg-accent" />
              <span
                class="tabular absolute right-2 bottom-1.5 text-[0.6875rem] font-semibold text-on-ghost"
              >
                {{ demoNow.time }}
              </span>
            </div>
          </div>
        </template>
        <div
          v-if="blockIndex < demoBreakMinutes.length"
          class="h-break border-b border-ghost-border"
        />
      </template>
    </div>
  </figure>
</template>
