<script setup lang="ts">
const { t } = useI18n();

useSeoMeta({
  title: `${t('legal.imprint.title')} — Olauda`,
  description: t('legal.imprint.description'),
  robots: 'noindex, follow',
});
</script>

<template>
  <LegalPage :title="t('legal.imprint.title')" :description="t('legal.imprint.description')">
    <LegalSection :title="t('legal.imprint.responsible')">
      <address class="not-italic text-on-ghost-muted leading-[1.8] text-base">
        Olauda<br />
        Deniz Keskin<br />
        Berlin<br />
        Germany
      </address>
    </LegalSection>

    <LegalSection :title="t('legal.imprint.contact')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">
        {{ t('legal.imprint.contact_label') }}
        <a
          href="mailto:kontakt@schul-dashboard.com"
          class="text-on-ghost underline hover:no-underline transition-all"
        >
          kontakt@schul-dashboard.com
        </a>
      </p>
    </LegalSection>

    <LegalSection :title="t('legal.imprint.disclaimer.title')">
      <p class="text-on-ghost-muted leading-[1.7] m-0">
        {{ t('legal.imprint.disclaimer.text') }}
      </p>
    </LegalSection>
  </LegalPage>
</template>

