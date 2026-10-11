<script setup lang="ts">
import { CalendarDays, KeyRound, ListTodo, Lock, Megaphone, Search, UsersRound } from '@lucide/vue';

const { t, tm, rt } = useI18n();

useSeoMetaWithI18n({
  title: () => t('pages.features.title'),
  description: () => t('pages.features.description'),
});

/** Icons match the app's navigation, so a section here looks like its place there. */
const SECTIONS = [
  { id: 'tasks', icon: ListTodo },
  { id: 'timetable', icon: CalendarDays },
  { id: 'groups', icon: UsersRound },
  { id: 'announcements', icon: Megaphone },
  { id: 'private', icon: Lock },
  { id: 'search', icon: Search },
  { id: 'account', icon: KeyRound },
] as const;

const { activeId } = useScrollSpy(SECTIONS.map((section) => section.id));

const sectionItems = (id: (typeof SECTIONS)[number]['id']) =>
  (tm(`features.sections.${id}.items`) as [string, string][]).map(([term, detail]) => ({
    term: rt(term),
    detail: rt(detail),
  }));
</script>

<template>
  <PageIntro :title="t('features.title')" :lede="t('features.lede')" />

  <div class="page page-grid gap-y-12 pt-[clamp(3.5rem,2rem+5vw,7rem)]">
    <nav :aria-label="t('features.index_label')" class="col-span-3 max-lg:hidden">
      <ul class="sticky top-[calc(var(--spacing-header)+2rem)] flex flex-col gap-0.5">
        <li v-for="section in SECTIONS" :key="section.id">
          <!-- The app sidebar's active marker: a short bar on the leading edge. -->
          <a
            :href="`#${section.id}`"
            class="relative flex h-10 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors duration-(--duration-hover) hover:bg-ghost-hover before:absolute before:top-1/2 before:left-0 before:h-0 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-action before:transition-[height] before:duration-300 before:ease-settle"
            :class="
              activeId === section.id
                ? 'text-on-ghost before:h-5'
                : 'text-on-ghost-muted hover:text-on-ghost'
            "
            :aria-current="activeId === section.id ? 'location' : undefined"
          >
            <component :is="section.icon" :size="20" aria-hidden="true" />
            {{ t(`features.sections.${section.id}.title`) }}
          </a>
        </li>
      </ul>
    </nav>

    <div
      class="col-span-12 flex flex-col gap-[clamp(4rem,2.5rem+4vw,7rem)] lg:col-span-8 lg:col-start-5"
    >
      <section
        v-for="section in SECTIONS"
        :id="section.id"
        :key="section.id"
        :aria-labelledby="`${section.id}-title`"
      >
        <component :is="section.icon" :size="24" aria-hidden="true" />
        <h2 :id="`${section.id}-title`" class="mt-5 text-title">
          {{ t(`features.sections.${section.id}.title`) }}
        </h2>
        <p class="mt-4 max-w-prose text-lede text-on-ghost-muted">
          {{ t(`features.sections.${section.id}.body`) }}
        </p>
        <dl class="mt-8">
          <div
            v-for="item in sectionItems(section.id)"
            :key="item.term"
            class="grid gap-x-8 gap-y-1 border-t border-ghost-border py-4 sm:grid-cols-[11rem_1fr]"
          >
            <dt class="font-semibold">{{ item.term }}</dt>
            <dd class="text-on-ghost-muted">{{ item.detail }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>

  <HomeClosing />
</template>
