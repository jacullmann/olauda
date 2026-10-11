<script setup lang="ts">
const { t } = useI18n();

const STEPS = ['create', 'timetable', 'invite', 'courses'] as const;
</script>

<template>
  <section class="page pt-section">
    <h2 class="text-title">{{ t('home.setup.title') }}</h2>
    <ol class="mt-12 grid gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      <li v-for="(step, index) in STEPS" :key="step" class="border-t border-on-ghost pt-5">
        <p class="tabular font-display text-lg/5 font-bold" aria-hidden="true">{{ index + 1 }}</p>
        <h3 class="mt-8 text-subtitle">{{ t(`home.setup.steps.${step}.title`) }}</h3>
        <p class="mt-2 text-on-ghost-muted">{{ t(`home.setup.steps.${step}.body`) }}</p>
      </li>
    </ol>
  </section>
</template>
