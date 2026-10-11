<script setup lang="ts">
import type { NuxtError } from '#app';

defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const localePath = useLocalePath();

useSeoMeta({ title: () => `${t('pages.not_found.title')} — Olauda`, robots: 'noindex' });
</script>

<template>
  <NuxtLayout>
    <PageIntro :title="t('not_found.title')" :lede="t('not_found.body')" />
    <div class="page pt-10 pb-section">
      <BaseButton :href="localePath('index')" variant="action" size="lg">
        {{ t('not_found.link') }}
      </BaseButton>
    </div>
  </NuxtLayout>
</template>
