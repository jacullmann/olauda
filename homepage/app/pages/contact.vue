<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue';

const { t } = useI18n();

useSeoMetaWithI18n({
  title: () => t('pages.contact.title'),
  description: () => t('pages.contact.description'),
});

const CONTACT_EMAIL = 'kontakt@olauda.com';

const channels: { key: 'discord' | 'status' | 'bugs'; href?: string }[] = [
  { key: 'discord', href: 'https://discord.gg/schul-dashboard' },
  { key: 'status', href: 'https://stats.uptimerobot.com/m8tUrWG3Zz' },
  { key: 'bugs' },
];
</script>

<template>
  <PageIntro :title="t('contact.title')" :lede="t('contact.lede')" />

  <div class="page pt-[clamp(3rem,2rem+4vw,6rem)] pb-section">
    <p class="text-label text-on-ghost-muted">{{ t('contact.email_label') }}</p>
    <a
      :href="`mailto:${CONTACT_EMAIL}`"
      class="link mt-2 inline-block font-display text-lesson font-bold break-all"
    >
      {{ CONTACT_EMAIL }}
    </a>

    <ul class="mt-[clamp(3.5rem,2rem+5vw,7rem)] grid gap-x-gutter md:grid-cols-3">
      <li
        v-for="channel in channels"
        :key="channel.key"
        class="flex flex-col items-start gap-2 border-t border-ghost-border py-6"
      >
        <h2 class="text-subtitle">{{ t(`contact.channels.${channel.key}.title`) }}</h2>
        <p class="max-w-prose text-on-ghost-muted">
          {{ t(`contact.channels.${channel.key}.body`) }}
        </p>
        <BaseButton
          v-if="channel.href"
          :href="channel.href"
          target="_blank"
          variant="surface"
          size="sm"
          :icon="ArrowUpRight"
          class="mt-3 flex-row-reverse"
        >
          {{ t(`contact.channels.${channel.key}.link`) }}
        </BaseButton>
      </li>
    </ul>
  </div>
</template>
