<script setup lang="ts">
const { t } = useI18n();
const appLinks = useAppLinks();
</script>

<template>
  <section class="page pt-[clamp(2.5rem,1rem+6vw,7rem)]">
    <div class="page-grid items-end gap-y-8">
      <h1 class="col-span-12 max-w-[12ch] text-display lg:col-span-7">
        {{ t('home.hero.title') }}
      </h1>

      <div class="col-span-12 flex max-w-prose flex-col gap-7 lg:col-span-5">
        <p class="text-lede text-on-ghost-muted">{{ t('home.hero.lede') }}</p>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <BaseButton :href="appLinks.register" target="_self" variant="action" size="lg">
              {{ t('common.register') }}
            </BaseButton>
            <BaseButton :href="appLinks.login" target="_self" variant="surface" size="lg">
              {{ t('common.login') }}
            </BaseButton>
          </div>
          <p class="text-label text-on-ghost-muted">{{ t('home.hero.invite_hint') }}</p>
        </div>
      </div>
    </div>

    <HomeLiveDay class="mt-[clamp(3.5rem,2rem+5vw,7rem)]" />
  </section>
</template>
