<script setup lang="ts">
const { t, tm, rt } = useI18n();

useSeoMetaWithI18n({
  title: () => t('pages.about.title'),
  description: () => t('pages.about.description'),
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('pages.about.title'),
    description: t('pages.about.description'),
    isPartOf: { '@id': 'https://olauda.com/#website' },
  },
});

const CONTACT_EMAIL = 'kontakt@olauda.com';

const principles = computed(() =>
  (tm('about.principles.items') as [string, string][]).map(([refusal, detail]) => ({
    refusal: rt(refusal),
    detail: rt(detail),
  })),
);
</script>

<template>
  <PageIntro :title="t('about.title')" :lede="t('about.lede')" />

  <section class="page page-grid gap-y-5 pt-section">
    <h2 class="col-span-12 text-title lg:col-span-4">{{ t('about.story.title') }}</h2>
    <p class="col-span-12 max-w-prose text-lede text-on-ghost-muted lg:col-span-7 lg:col-start-6">
      {{ t('about.story.body') }}
    </p>
  </section>

  <section class="page pt-section">
    <h2 class="text-title">{{ t('about.principles.title') }}</h2>
    <!-- Struck through in the timetable's "canceled" red: things that are off the table. -->
    <ul class="mt-10">
      <li
        v-for="item in principles"
        :key="item.refusal"
        class="grid gap-x-gutter gap-y-2 border-t border-ghost-border py-6 lg:grid-cols-12 lg:items-baseline"
      >
        <p
          class="font-display text-lesson font-medium text-on-ghost-subtle line-through decoration-danger decoration-[0.07em] lg:col-span-7"
        >
          {{ item.refusal }}
        </p>
        <p class="max-w-prose text-on-ghost-muted lg:col-span-5">{{ item.detail }}</p>
      </li>
    </ul>
  </section>

  <section class="page page-grid gap-y-5 pt-section">
    <h2 class="col-span-12 text-title lg:col-span-4">{{ t('about.team.title') }}</h2>
    <div class="col-span-12 flex flex-col items-start gap-8 lg:col-span-7 lg:col-start-6">
      <p class="max-w-prose text-lede text-on-ghost-muted">{{ t('about.team.body') }}</p>
      <BaseButton :href="`mailto:${CONTACT_EMAIL}`" variant="surface">{{
        CONTACT_EMAIL
      }}</BaseButton>
    </div>
  </section>

  <HomeClosing />
</template>
