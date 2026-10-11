<script setup lang="ts">
import { ArrowRight } from '@lucide/vue';

const { t } = useI18n();
const appLinks = useAppLinks();
</script>

<template>
  <section class="page pt-section pb-section">
    <div class="flex flex-col items-start gap-10">
      <h2 class="max-w-[16ch] font-serif text-display">
        <i18n-t keypath="cta.title" scope="global">
          <template #emphasis>
            <em>{{ t('cta.title_emphasis') }}</em>
          </template>
        </i18n-t>
      </h2>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
        <BaseButton
          :href="appLinks.register"
          target="_self"
          variant="action"
          size="lg"
          :icon="ArrowRight"
        >
          {{ t('cta.button') }}
        </BaseButton>
        <p class="text-[0.9375rem] text-on-ghost-muted">
          <i18n-t keypath="cta.question" scope="global">
            <template #email>
              <a href="mailto:kontakt@olauda.com" class="link-underline text-on-ghost">
                kontakt@olauda.com
              </a>
            </template>
          </i18n-t>
        </p>
      </div>
    </div>
  </section>
</template>
