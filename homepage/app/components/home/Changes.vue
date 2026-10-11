<script setup lang="ts">
const { t } = useI18n();

const changes = [
  { key: 'room', periods: '1–2', subject: 'biology' },
  { key: 'substitute', periods: '5–6', subject: 'computing' },
  { key: 'cancelled', periods: '5–6', subject: 'physics' },
] as const;
</script>

<template>
  <PageChapter :label="t('home.changes.label')">
    <h2 class="col-span-12 font-serif text-headline lg:col-span-9">
      <i18n-t keypath="home.changes.title" scope="global">
        <template #emphasis>
          <em>{{ t('home.changes.title_emphasis') }}</em>
        </template>
      </i18n-t>
    </h2>

    <p class="col-span-12 text-lede text-on-ghost-muted md:col-span-6 lg:col-span-4 lg:col-start-4">
      {{ t('home.changes.body') }}
    </p>

    <dl
      class="col-span-12 m-0 border-t border-ghost-border md:col-span-6 lg:col-span-5 lg:col-start-8"
    >
      <div
        v-for="change in changes"
        :key="change.key"
        class="grid grid-cols-[3.5rem_1fr] gap-x-4 border-b border-ghost-border py-4"
      >
        <dt class="tabular text-[0.8125rem] text-on-ghost-subtle">{{ change.periods }}</dt>
        <dd class="m-0 flex flex-col gap-1">
          <span class="text-[0.9375rem] font-medium">
            {{ t(`home.subjects.${change.subject}`) }}
            <span v-if="change.key === 'cancelled'" class="font-normal text-on-ghost-subtle">
              · {{ t('home.days.fri') }}
            </span>
          </span>
          <span
            class="text-[0.8125rem]"
            :class="change.key === 'cancelled' ? 'font-medium text-danger' : 'text-on-ghost-muted'"
          >
            {{ t(`home.changes.items.${change.key}`) }}
          </span>
        </dd>
      </div>
    </dl>
  </PageChapter>

  <div class="mt-figure bg-accent text-on-accent">
    <div class="page flex min-h-12 items-center gap-6 py-3">
      <p class="flex-1 text-center text-sm font-medium">{{ t('home.changes.announcement') }}</p>
      <span class="tabular text-xs opacity-80">1/3</span>
    </div>
  </div>
  <p class="page mt-4 text-label text-on-ghost-subtle">
    {{ t('home.changes.announcement_caption') }}
  </p>
</template>
