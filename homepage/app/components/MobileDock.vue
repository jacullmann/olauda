<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
const appLinks = useAppLinks();
// Contact lives in the footer on phones; three links and the button don't fit 375px in German.
const navItems = useSiteNav().filter((item) => item.name !== 'contact');
</script>

<template>
  <!-- The homepage's take on the app's floating tab bar: navigation within thumb reach. -->
  <nav
    :aria-label="t('nav.label')"
    class="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-(--z-dock) flex justify-center px-4 md:hidden"
  >
    <ul
      class="flex max-w-full items-center gap-0.5 rounded-full border border-ghost-border bg-surface/85 p-1 shadow-menu backdrop-blur-md backdrop-saturate-150"
    >
      <li v-for="item in navItems" :key="item.name">
        <NuxtLink
          :to="localePath(item.name)"
          class="flex h-10 items-center rounded-full px-2.5 text-sm/4 font-medium text-on-ghost-muted transition-colors duration-(--duration-hover) aria-[current=page]:bg-ghost-hover aria-[current=page]:text-on-ghost"
        >
          {{ t(item.labelKey) }}
        </NuxtLink>
      </li>
      <li class="pl-1">
        <BaseButton :href="appLinks.register" target="_self" variant="action">
          {{ t('common.register') }}
        </BaseButton>
      </li>
    </ul>
  </nav>
</template>
