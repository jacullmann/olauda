<script setup lang="ts">
const { t, tm, rt } = useI18n();

useSeoMetaWithI18n({
  title: () => `${t('pages.features.title')} — Olauda`,
  description: () => t('pages.features.description'),
  keywords: 'features, tasks, timetable, substitutions, announcements, group chat, private notes',
});

const chapters = [
  'tasks',
  'timetable',
  'announcements',
  'chat',
  'groups',
  'private',
  'search',
  'account',
] as const;

const { activeId } = useScrollSpy(chapters);

function chapterItems(chapter: (typeof chapters)[number]) {
  return (tm(`features.chapters.${chapter}.items`) as unknown[]).map((item) => rt(item as string));
}
</script>

<template>
  <section class="page pt-intro">
    <div class="page-grid gap-y-10">
      <h1 class="col-span-12 font-serif text-display lg:col-span-10">
        <i18n-t keypath="features.title" scope="global">
          <template #name>
            <span class="whitespace-nowrap">Olauda</span>
          </template>
          <template #emphasis>
            <em>{{ t('features.title_emphasis') }}</em>
          </template>
        </i18n-t>
      </h1>
      <p
        class="col-span-12 text-lede text-on-ghost-muted md:col-span-7 lg:col-span-5 lg:col-start-7"
      >
        {{ t('features.lede') }}
      </p>
    </div>
  </section>

  <div class="page page-grid pt-section">
    <nav class="hidden lg:col-span-3 lg:block" :aria-label="t('features.index_label')">
      <div class="sticky top-[calc(var(--spacing-header)+1.25rem)] flex flex-col gap-4">
        <p class="border-t border-on-ghost pt-5 text-label font-medium">
          {{ t('features.index_label') }}
        </p>
        <ol class="flex flex-col">
          <li v-for="(chapter, index) in chapters" :key="chapter">
            <a
              :href="`#${chapter}`"
              class="flex items-baseline gap-3 py-1.5 text-[0.9375rem] transition-colors"
              :class="
                activeId === chapter ? 'text-on-ghost' : 'text-on-ghost-subtle hover:text-on-ghost'
              "
              :aria-current="activeId === chapter ? 'location' : undefined"
            >
              <span class="tabular w-4 font-serif text-lg lining-nums">{{ index + 1 }}</span>
              {{ t(`features.chapters.${chapter}.title`) }}
            </a>
          </li>
        </ol>
      </div>
    </nav>

    <div class="col-span-12 flex flex-col gap-figure lg:col-span-9">
      <article
        v-for="(chapter, index) in chapters"
        :id="chapter"
        :key="chapter"
        class="grid gap-x-gutter gap-y-8 border-t border-on-ghost pt-5 md:grid-cols-9"
      >
        <p class="tabular font-serif text-title lining-nums md:col-span-1">{{ index + 1 }}</p>
        <div class="flex flex-col gap-5 md:col-span-8">
          <h2 class="font-serif text-title">
            {{ t(`features.chapters.${chapter}.title`) }}
          </h2>
          <p class="max-w-prose text-lede text-on-ghost-muted">
            {{ t(`features.chapters.${chapter}.body`) }}
          </p>
          <ul class="mt-4 grid gap-x-gutter border-t border-ghost-border sm:grid-cols-2">
            <li
              v-for="item in chapterItems(chapter)"
              :key="item"
              class="border-b border-ghost-border py-3.5 text-[0.9375rem]"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </article>
    </div>
  </div>

  <CallToAction />
</template>
