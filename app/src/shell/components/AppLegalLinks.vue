<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLegalLinks } from '@/shell/composables/useLegalLinks';

const { t } = useI18n();
const { imprintUrl, privacyPolicyUrl, termsUrl } = useLegalLinks();

const links = computed(() => [
  { key: 'imprint', url: imprintUrl.value },
  { key: 'privacy', url: privacyPolicyUrl.value },
  { key: 'terms', url: termsUrl.value },
]);
</script>

<template>
  <nav
    :aria-label="t('legal.title')"
    class="flex flex-wrap justify-center gap-x-6 gap-y-2"
  >
    <BaseLink
      v-for="link in links"
      :key="link.key"
      :to="link.url"
      class="text-sm text-on-ghost-muted"
    >
      {{ t(`legal.${link.key}.title`) }}
    </BaseLink>
  </nav>
</template>
