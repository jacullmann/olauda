<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue';

const { t } = useI18n();

useSeoMetaWithI18n({
  title: () => `${t('pages.contact.title')} — Olauda`,
  description: () => t('pages.contact.description'),
  keywords: 'contact, support, email, discord',
});

const email = 'kontakt@schul-dashboard.com';

const channels: { key: 'discord' | 'status' | 'bugs'; href?: string }[] = [
  { key: 'discord', href: 'https://discord.gg/schul-dashboard' },
  { key: 'status', href: 'https://stats.uptimerobot.com/m8tUrWG3Zz' },
  { key: 'bugs' },
];
</script>

<template>
  <section class="page pt-intro pb-section">
    <div class="page-grid gap-y-10">
      <h1 class="col-span-12 font-serif text-display lg:col-span-10">
        <i18n-t keypath="contact.title" scope="global">
          <template #emphasis>
            <em>{{ t('contact.title_emphasis') }}</em>
          </template>
        </i18n-t>
      </h1>
      <p
        class="col-span-12 text-lede text-on-ghost-muted md:col-span-7 lg:col-span-5 lg:col-start-7"
      >
        {{ t('contact.lede') }}
      </p>

      <div class="col-span-12 mt-figure flex flex-col gap-3 border-t border-on-ghost pt-5">
        <p class="text-label font-medium">{{ t('contact.email_label') }}</p>
        <a
          :href="`mailto:${email}`"
          class="w-fit font-serif text-headline break-all underline decoration-ghost-border decoration-1 underline-offset-[0.14em] transition-colors hover:decoration-current sm:break-normal"
        >
          {{ email }}
        </a>
      </div>

      <ul class="col-span-12 grid gap-x-gutter gap-y-10 sm:grid-cols-3">
        <li
          v-for="channel in channels"
          :key="channel.key"
          class="flex flex-col gap-2 border-t border-ghost-border pt-4"
        >
          <h2 class="text-[0.9375rem] font-semibold">
            {{ t(`contact.channels.${channel.key}.title`) }}
          </h2>
          <p class="text-[0.9375rem] leading-relaxed text-on-ghost-muted">
            {{ t(`contact.channels.${channel.key}.body`) }}
          </p>
          <a
            v-if="channel.href"
            :href="channel.href"
            target="_blank"
            rel="noopener noreferrer"
            class="group mt-1 inline-flex w-fit items-center gap-1 text-[0.9375rem] font-medium"
          >
            <span class="link-underline">{{ t(`contact.channels.${channel.key}.link`) }}</span>
            <ArrowUpRight
              :size="16"
              :stroke-width="1.75"
              class="transition-transform duration-200 ease-out-quint group-hover:translate-x-px group-hover:-translate-y-px"
              aria-hidden="true"
            />
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
