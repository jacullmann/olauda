<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({
  title: `${t('legal.terms.title')} — Olauda`,
  description: t('legal.terms.description'),
  robots: 'noindex, follow',
});

const accountItems = [
  'legal.terms.account.item0',
  'legal.terms.account.item1',
  'legal.terms.account.item2',
  'legal.terms.account.item3',
];

const conductItems = [
  'legal.terms.conduct.item0',
  'legal.terms.conduct.item1',
  'legal.terms.conduct.item2',
  'legal.terms.conduct.item3',
];
</script>

<template>
  <LegalPage :title="t('legal.terms.title')" :description="t('legal.terms.description')">
    <LegalSection :title="t('legal.terms.acceptance.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.acceptance.text') }}</p>
    </LegalSection>

    <LegalSection :title="t('legal.terms.service.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.service.text') }}</p>
    </LegalSection>

    <LegalSection :title="t('legal.terms.account.title')">
      <ul class="mt-1 flex flex-col gap-2 pl-5 list-disc">
        <li v-for="key in accountItems" :key="key" class="text-on-ghost-muted leading-[1.6]">
          {{ t(key) }}
        </li>
      </ul>
    </LegalSection>

    <LegalSection :title="t('legal.terms.conduct.title')">
      <p class="text-on-ghost-muted leading-[1.7] mb-3">{{ t('legal.terms.conduct.intro') }}</p>
      <ul class="flex flex-col gap-2 pl-5 list-disc">
        <li v-for="key in conductItems" :key="key" class="text-on-ghost-muted leading-[1.6]">
          {{ t(key) }}
        </li>
      </ul>
    </LegalSection>

    <LegalSection :title="t('legal.terms.termination.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.termination.text') }}</p>
    </LegalSection>

    <LegalSection :title="t('legal.terms.availability.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.availability.text') }}</p>
    </LegalSection>

    <LegalSection :title="t('legal.terms.changes.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.changes.text') }}</p>
    </LegalSection>

    <LegalSection :title="t('legal.terms.governing.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">{{ t('legal.terms.governing.text') }}</p>
    </LegalSection>
  </LegalPage>
</template>
