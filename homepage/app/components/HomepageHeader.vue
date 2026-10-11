<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const appLinks = useAppLinks();
const { y } = useWindowScroll();

const isScrolled = computed(() => y.value > 4);
const navItems = useSiteNav();
</script>

<template>
  <header
    class="sticky top-0 z-(--z-header) bg-canvas transition-[box-shadow] duration-200"
    :class="isScrolled && 'shadow-[0_1px_0_var(--color-ghost-border)]'"
  >
    <div class="page flex h-header items-center gap-6">
      <NuxtLink
        :to="localePath('index')"
        :aria-label="t('nav.home')"
        class="-ml-1 flex items-center gap-2 rounded-full p-1 font-display text-[1.375rem] font-bold tracking-[-0.02em]"
      >
        <BrandLogo class="size-7" />
        <span>Olauda</span>
      </NuxtLink>

      <nav :aria-label="t('nav.label')" class="hidden md:block">
        <ul class="flex items-center gap-1">
          <li v-for="item in navItems" :key="item.name">
            <NuxtLink
              :to="localePath(item.name)"
              class="relative flex h-9 items-center rounded-full px-3.5 text-sm/4 font-medium text-on-ghost-muted transition-colors duration-(--duration-hover) hover:bg-ghost-hover hover:text-on-ghost aria-[current=page]:text-on-ghost after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-0 after:-translate-x-1/2 after:rounded-full after:bg-action after:transition-[width] after:duration-300 after:ease-settle aria-[current=page]:after:w-3"
            >
              {{ t(item.labelKey) }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="ml-auto flex items-center gap-1">
        <BaseButton :href="appLinks.login" target="_self">{{ t('common.login') }}</BaseButton>
        <BaseButton :href="appLinks.register" target="_self" variant="action" class="max-md:hidden">
          {{ t('common.register') }}
        </BaseButton>
      </div>
    </div>
  </header>
</template>
