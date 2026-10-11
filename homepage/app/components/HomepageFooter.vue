<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const appLinks = useAppLinks();

const columns = computed(() => [
  {
    titleKey: 'footer.product',
    links: [
      { labelKey: 'nav.features', to: localePath('features') },
      { labelKey: 'common.login', href: appLinks.login },
      { labelKey: 'common.getStarted', href: appLinks.register },
    ],
  },
  {
    titleKey: 'footer.project',
    links: [
      { labelKey: 'nav.about', to: localePath('about') },
      { labelKey: 'nav.contact', to: localePath('contact') },
      {
        labelKey: 'footer.status',
        href: 'https://stats.uptimerobot.com/m8tUrWG3Zz',
        external: true,
      },
    ],
  },
  {
    titleKey: 'footer.legal',
    links: [
      { labelKey: 'footer.imprint', to: localePath('legal-imprint') },
      { labelKey: 'footer.privacy', to: localePath('legal-privacy-policy') },
      { labelKey: 'footer.terms', to: localePath('legal-terms') },
    ],
  },
]);
</script>

<template>
  <footer>
    <div class="h-px bg-ghost-border" />
    <div class="page page-grid gap-y-12 pt-14 pb-10">
      <div class="col-span-12 flex flex-col gap-4 lg:col-span-6">
        <NuxtLink
          :to="localePath('index')"
          class="-ml-1 flex w-fit items-center gap-2.5 rounded-md px-1 py-1"
          :aria-label="t('nav.home')"
        >
          <BrandLogo class="size-6 shrink-0" />
          <span class="text-[0.9375rem] font-semibold tracking-[-0.01em]">Olauda</span>
        </NuxtLink>
        <p class="max-w-[22rem] text-[0.9375rem] leading-relaxed text-on-ghost-muted">
          {{ t('footer.tagline') }}
        </p>
      </div>

      <nav
        v-for="column in columns"
        :key="column.titleKey"
        class="col-span-6 flex flex-col gap-3 sm:col-span-4 lg:col-span-2"
        :aria-label="t(column.titleKey)"
      >
        <p class="text-label text-on-ghost-subtle">{{ t(column.titleKey) }}</p>
        <ul class="flex flex-col gap-2.5">
          <li v-for="link in column.links" :key="link.labelKey">
            <NuxtLink
              v-if="link.to"
              :to="link.to"
              class="text-[0.9375rem] text-on-ghost-muted transition-colors hover:text-on-ghost"
            >
              {{ t(link.labelKey) }}
            </NuxtLink>
            <a
              v-else
              :href="link.href"
              :target="link.external ? '_blank' : undefined"
              :rel="link.external ? 'noopener noreferrer' : undefined"
              class="text-[0.9375rem] text-on-ghost-muted transition-colors hover:text-on-ghost"
            >
              {{ t(link.labelKey) }}
            </a>
          </li>
        </ul>
      </nav>

      <div
        class="col-span-12 flex flex-wrap items-center gap-x-8 gap-y-5 border-t border-ghost-border pt-6 text-[0.8125rem] text-on-ghost-subtle"
      >
        <p class="mr-auto">© {{ new Date().getFullYear() }} Olauda · {{ t('footer.made_in') }}</p>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </div>
  </footer>
</template>
