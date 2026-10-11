<script setup lang="ts">
const { t } = useI18n();

/** The app's generated-avatar palette (app/src/modules/auth/utils/avatar.ts). */
const AVATAR_COLORS = [
  '#AA47BD',
  '#7B1FA2',
  '#77919D',
  '#455A65',
  '#EC417A',
  '#C1175C',
  '#0388D2',
  '#0098A7',
  '#EF6C00',
  '#F6511E',
];
const INITIALS = 'MLJEFANSKTPBHCIDROGVLEMNAJFT';
const COLUMNS = 7;

const classmates = [...INITIALS].map((initial, index) => {
  const row = Math.floor(index / COLUMNS);
  const column = index % COLUMNS;
  return {
    initial,
    color: AVATAR_COLORS[(index * 7 + 3) % AVATAR_COLORS.length],
    // The change spreads outwards from whoever saved it, seat by seat.
    distance: Math.hypot(row, column),
  };
});

const isSaved = ref(false);
</script>

<template>
  <figure
    class="rounded-3xl border border-ghost-border bg-surface p-4 shadow-input sm:p-6"
    :aria-label="t('home.roster.label')"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="flex items-center gap-2.5 text-sm font-medium">
        {{ t('home.roster.lesson') }}
        <span class="rounded-full bg-danger/12 px-2.5 py-1 text-label font-medium text-danger">
          {{ t('home.roster.change') }}
        </span>
      </p>
      <BaseButton
        :variant="isSaved ? 'surface' : 'action'"
        size="sm"
        :aria-pressed="isSaved"
        @click="isSaved = !isSaved"
      >
        {{ isSaved ? t('home.roster.reset') : t('home.roster.save') }}
      </BaseButton>
    </div>

    <ul class="mt-6 grid grid-cols-[repeat(7,auto)] justify-between gap-y-2.5 sm:gap-y-3" aria-hidden="true">
      <li
        v-for="(classmate, index) in classmates"
        :key="index"
        class="relative flex size-9 items-center justify-center rounded-full font-display text-sm font-bold text-white sm:size-10"
        :class="index === 0 && 'ring-2 ring-action ring-offset-2 ring-offset-surface'"
        :style="{ backgroundColor: classmate.color }"
      >
        {{ classmate.initial }}
        <span
          class="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-danger ring-2 ring-surface transition-[scale,opacity] sm:size-3.5"
          :class="
            isSaved
              ? 'scale-100 opacity-100 duration-700 ease-spring'
              : 'scale-0 opacity-0 duration-150'
          "
          :style="{ transitionDelay: isSaved ? `${classmate.distance * 55}ms` : '0ms' }"
        />
      </li>
    </ul>

    <figcaption class="mt-5 text-sm text-on-ghost-muted" aria-live="polite">
      {{ isSaved ? t('home.roster.done') : t('home.roster.idle') }}
    </figcaption>
  </figure>
</template>
