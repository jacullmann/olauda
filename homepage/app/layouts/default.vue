<script setup lang="ts">
const i18nHead = useLocaleHead({ seo: true });

useHead({
  htmlAttrs: { lang: () => i18nHead.value.htmlAttrs.lang },
  link: () => i18nHead.value.link,
  meta: () => i18nHead.value.meta,
});
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <HomepageHeader />
    <main class="flex-1">
      <slot />
    </main>
    <HomepageFooter />
    <MobileDock />
  </div>
</template>
