<script setup lang="ts">
const { t } = useI18n();
const appLinks = useAppLinks();
</script>

<template>
  <section class="page pt-section pb-[clamp(4rem,2rem+6vw,8rem)]">
    <!-- Inverted like the highlighted lesson in the timetable: this is what comes next. -->
    <div
      class="flex flex-col gap-10 rounded-3xl bg-action px-6 py-12 text-on-action sm:px-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:px-16 lg:py-20"
    >
      <div class="max-w-xl">
        <h2 class="text-display">{{ t('home.closing.title') }}</h2>
        <p class="mt-6 text-lede text-on-action-muted">{{ t('home.closing.body') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <BaseButton :href="appLinks.register" target="_self" variant="inverse" size="lg">
          {{ t('common.register') }}
        </BaseButton>
        <BaseButton :href="appLinks.login" target="_self" variant="inverse-ghost" size="lg">
          {{ t('common.login') }}
        </BaseButton>
      </div>
    </div>
  </section>
</template>
