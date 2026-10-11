<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ showQuote: boolean }>();

const i18n = useI18n();
const locale = i18n.locale;

const randomIndex = ref<number | null>(null);
const isVisible = ref(false);

const getDaysToBerlinBreak = (): number | null => {
  const now = new Date();
  const holidays = [
    new Date('2026-01-31'), // Winterferien 2026
    new Date('2026-03-28'), // Osterferien
    new Date('2026-07-09'), // Sommerferien
    new Date('2026-10-17'), // Herbstferien
    new Date('2026-12-23'), // Weihnachtsferien
    new Date('2027-01-29'), // Winterferien 2027
    new Date('2027-03-20'), // Osterferien
    new Date('2027-07-01'), // Sommerferien
  ];

  const nextHoliday = holidays.find((h) => h.getTime() > now.getTime());

  if (!nextHoliday) return null;

  const diffTime = Math.abs(nextHoliday.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const displayQuote = computed(() => {
  if (!props.showQuote || randomIndex.value === null) return '';
  return i18n.t(`common.footer.quotes.${randomIndex.value}`, {
    daysToHoliday: getDaysToBerlinBreak() ?? '?',
  });
});

// v-for over a string iterates UTF-16 code units, which splits emoji into
// lone surrogates that render as U+FFFD.
const quoteGraphemes = computed(() =>
  Array.from(
    new Intl.Segmenter(locale.value, { granularity: 'grapheme' }).segment(
      displayQuote.value,
    ),
    ({ segment }) => segment,
  ),
);

onMounted(() => {
  const quotes = i18n.tm('common.footer.quotes');

  if (quotes && quotes.length > 0) {
    randomIndex.value = Math.floor(Math.random() * quotes.length);

    setTimeout(() => {
      isVisible.value = true;
    }, 100);
  }
});
</script>

<template>
  <p class="text-base font-sans m-0! min-h-6">
    <span class="text-on-ghost font-bold mr-2">{{
      new Date().toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    }}</span>
    <span
      v-for="(char, index) in quoteGraphemes"
      :key="index"
      class="italic [font-synthesis-style:none] font-medium text-on-ghost-muted pr-1 -mr-1 transition-[opacity,filter,transform] duration-250"
      :class="isVisible ? 'opacity-100 blur-none' : 'opacity-0 blur-[3px]'"
      :style="{ transitionDelay: `${index * 6}ms` }"
    >
      {{ char }}
    </span>
  </p>
</template>
