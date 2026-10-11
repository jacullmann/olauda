<script setup lang="ts">
type Message = Parameters<ReturnType<typeof useI18n>['rt']>[0];

interface RawSection {
  title: Message;
  paragraphs?: Message[];
  items?: Message[];
  outro?: Message[];
}

const { t, tm, rt } = useI18n();

useSeoMeta({
  title: `${t('legal.privacy.title')} — Olauda`,
  description: t('legal.privacy.description'),
  robots: 'noindex, follow',
});

// The policy lives entirely in the locale files, so editing it never touches this page.
const sections = computed(() =>
  (tm('legal.privacy.sections') as RawSection[]).map((section) => ({
    title: rt(section.title),
    paragraphs: (section.paragraphs ?? []).map((p) => rt(p)),
    items: (section.items ?? []).map((i) => rt(i)),
    outro: (section.outro ?? []).map((p) => rt(p)),
  })),
);
</script>

<template>
  <LegalPage :title="t('legal.privacy.title')" :description="t('legal.privacy.description')">
    <LegalSection v-for="section in sections" :key="section.title" :title="section.title">
      <div class="flex flex-col gap-3 leading-[1.7] text-on-ghost-muted">
        <p v-for="paragraph in section.paragraphs" :key="paragraph" class="m-0">
          {{ paragraph }}
        </p>
        <ul v-if="section.items.length" class="flex list-disc flex-col gap-2 pl-5 leading-[1.6]">
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
        <p v-for="paragraph in section.outro" :key="paragraph" class="m-0">
          {{ paragraph }}
        </p>
      </div>
    </LegalSection>
  </LegalPage>
</template>
