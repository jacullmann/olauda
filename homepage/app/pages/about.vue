<script setup lang="ts">
const { t } = useI18n();

useSeoMetaWithI18n({
  title: () => `${t('pages.about.title')} — Olauda`,
  description: () => t('pages.about.description'),
  keywords: 'about, mission, student project, school management, Berlin',
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: t('pages.about.title'),
    description: t('pages.about.description'),
    isPartOf: { '@id': 'https://olauda.com/#website' },
  },
});

const principles = ['free', 'private', 'students', 'simple'] as const;
</script>

<template>
  <section class="page pt-intro">
    <div class="page-grid gap-y-10">
      <h1 class="col-span-12 font-serif text-display lg:col-span-11">
        <i18n-t keypath="about.title" scope="global">
          <template #emphasis>
            <em>{{ t('about.title_emphasis') }}</em>
          </template>
        </i18n-t>
      </h1>
      <p
        class="col-span-12 text-lede text-on-ghost-muted md:col-span-7 lg:col-span-5 lg:col-start-7"
      >
        {{ t('about.lede') }}
      </p>
    </div>
  </section>

  <PageChapter :label="t('about.story.label')">
    <div class="col-span-12 flex flex-col gap-8 lg:col-span-8">
      <p class="font-serif text-statement">{{ t('about.story.lead') }}</p>
      <p class="max-w-prose text-lede text-on-ghost-muted">{{ t('about.story.body') }}</p>
    </div>
  </PageChapter>

  <PageChapter :label="t('about.principles.label')">
    <dl class="col-span-12 m-0 lg:col-span-9">
      <div
        v-for="principle in principles"
        :key="principle"
        class="grid gap-x-gutter gap-y-3 border-b border-ghost-border py-7 first:pt-0 md:grid-cols-9"
      >
        <dt class="font-serif text-[1.625rem] leading-tight tracking-[-0.015em] md:col-span-4">
          {{ t(`about.principles.items.${principle}.title`) }}
        </dt>
        <dd class="m-0 text-[0.9375rem] leading-relaxed text-on-ghost-muted md:col-span-5">
          {{ t(`about.principles.items.${principle}.body`) }}
        </dd>
      </div>
    </dl>
  </PageChapter>

  <PageChapter :label="t('about.team.label')">
    <div class="col-span-12 flex flex-col gap-4 lg:col-span-6">
      <p class="text-lede text-on-ghost-muted">{{ t('about.team.body') }}</p>
      <p class="text-label text-on-ghost-subtle">{{ t('about.team.place') }}</p>
    </div>
  </PageChapter>

  <CallToAction />
</template>
