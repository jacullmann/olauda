<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const localePath = useLocalePath();

useSeoMeta({ title: () => `${t('pages.not_found.title')} — Olauda`, robots: 'noindex' });
</script>

<template>
  <NuxtLayout>
    <section class="page page-grid gap-y-8 pt-intro pb-section">
      <p class="tabular col-span-12 text-label font-medium text-danger">
        {{ props.error.statusCode ?? t('not_found.label') }}
      </p>
      <h1 class="col-span-12 font-serif text-display">{{ t('not_found.title') }}</h1>
      <p class="col-span-12 text-lede text-on-ghost-muted md:col-span-6">
        {{ t('not_found.body') }}
      </p>
      <NuxtLink
        :to="localePath('index')"
        class="link-underline col-span-12 w-fit text-[0.9375rem] font-medium"
      >
        {{ t('not_found.link') }}
      </NuxtLink>
    </section>
  </NuxtLayout>
</template>
