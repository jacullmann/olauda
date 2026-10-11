<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const navItems = useSiteNav();

const STATUS_URL = 'https://stats.uptimerobot.com/m8tUrWG3Zz';
const year = new Date().getFullYear();

const legalLinks = [
  { name: 'legal-imprint', labelKey: 'footer.imprint' },
  { name: 'legal-privacy-policy', labelKey: 'footer.privacy' },
  { name: 'legal-terms', labelKey: 'footer.terms' },
] as const;

const linkClass =
  'text-on-ghost-muted transition-colors duration-(--duration-hover) hover:text-on-ghost';
</script>

<template>
  <footer class="border-t border-ghost-border pb-28 md:pb-0">
    <div class="page page-grid gap-y-12 pt-16 pb-10 md:pt-20">
      <div class="col-span-12 flex flex-col gap-4 md:col-span-5">
        <NuxtLink
          :to="localePath('index')"
          :aria-label="t('nav.home')"
          class="flex w-fit items-center gap-2 font-display text-[1.375rem] font-bold tracking-[-0.02em]"
        >
          <BrandLogo class="size-7" />
          <span>Olauda</span>
        </NuxtLink>
        <p class="max-w-72 text-sm text-on-ghost-muted">{{ t('footer.tagline') }}</p>
      </div>

      <nav
        class="col-span-6 text-sm md:col-span-3 md:col-start-7"
        :aria-label="t('footer.product')"
      >
        <h2 class="mb-4 font-sans text-sm font-medium">{{ t('footer.product') }}</h2>
        <ul class="flex flex-col gap-2.5">
          <li v-for="item in navItems" :key="item.name">
            <NuxtLink :to="localePath(item.name)" :class="linkClass">{{
              t(item.labelKey)
            }}</NuxtLink>
          </li>
          <li>
            <a :href="STATUS_URL" target="_blank" rel="noopener noreferrer" :class="linkClass">
              {{ t('footer.status') }}
            </a>
          </li>
        </ul>
      </nav>

      <nav class="col-span-6 text-sm md:col-span-3" :aria-label="t('footer.legal')">
        <h2 class="mb-4 font-sans text-sm font-medium">{{ t('footer.legal') }}</h2>
        <ul class="flex flex-col gap-2.5">
          <li v-for="item in legalLinks" :key="item.name">
            <NuxtLink :to="localePath(item.name)" :class="linkClass">{{
              t(item.labelKey)
            }}</NuxtLink>
          </li>
        </ul>
      </nav>

      <div
        class="col-span-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-t border-ghost-border pt-6 text-label text-on-ghost-muted"
      >
        <p class="tabular">{{ t('footer.rights', { year }) }}</p>
        <div class="flex items-center gap-6">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </div>
  </footer>
</template>
