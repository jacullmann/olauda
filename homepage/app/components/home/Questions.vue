<script setup lang="ts">
import { Plus } from '@lucide/vue';

const { t, tm, rt } = useI18n();

const CONTACT_EMAIL = 'contact@olauda.com';

const questions = computed(() =>
  (tm('home.faq.items') as { q: string; a: string }[]).map((item) => ({
    question: rt(item.q),
    answer: rt(item.a),
  })),
);
</script>

<template>
  <section class="page page-grid gap-y-10 pt-section">
    <div class="col-span-12 lg:col-span-4">
      <h2 class="text-title lg:sticky lg:top-[calc(var(--spacing-header)+2rem)]">
        {{ t('home.faq.title') }}
      </h2>
    </div>

    <div class="col-span-12 lg:col-span-7 lg:col-start-6">
      <details
        v-for="item in questions"
        :key="item.question"
        class="faq group border-b border-ghost-border first:border-t"
      >
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg/6 font-semibold [&::-webkit-details-marker]:hidden"
        >
          {{ item.question }}
          <Plus
            :size="20"
            class="shrink-0 text-on-ghost-muted transition-transform duration-300 ease-settle group-open:rotate-45"
            aria-hidden="true"
          />
        </summary>
        <p class="max-w-prose pb-6 text-on-ghost-muted">{{ item.answer }}</p>
      </details>

      <p class="mt-8 text-on-ghost-muted">
        <i18n-t keypath="home.faq.more" scope="global">
          <template #email>
            <a :href="`mailto:${CONTACT_EMAIL}`" class="link font-medium text-on-ghost">
              {{ CONTACT_EMAIL }}
            </a>
          </template>
        </i18n-t>
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Animates the answer open where the browser can size to auto; elsewhere it just appears. */
@supports (interpolate-size: allow-keywords) {
  .faq {
    interpolate-size: allow-keywords;
  }

  .faq::details-content {
    height: 0;
    overflow: clip;
    transition:
      height 350ms var(--ease-settle),
      content-visibility 350ms allow-discrete;
  }

  .faq[open]::details-content {
    height: auto;
  }
}
</style>
