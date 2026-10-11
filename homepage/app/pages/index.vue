<script setup lang="ts">
const { t } = useI18n();

useSeoMetaWithI18n({
  title: () => t('pages.home.title'),
  description: () => t('pages.home.description'),
});
</script>

<template>
  <HomeHero />
  <HomeLayers />
  <HomeSetup />
  <HomeQuestions />
  <HomeClosing />
</template>
