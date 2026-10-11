<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useLegalLinks } from '@/shell/composables/useLegalLinks';

defineProps<{
  describedBy?: string;
}>();

const accepted = defineModel<boolean>({ required: true });

const { t } = useI18n();
const { privacyPolicyUrl, termsUrl } = useLegalLinks();
</script>

<template>
  <BaseCheckbox v-model="accepted" :aria-describedby="describedBy">
    <i18n-t keypath="auth.login.terms">
      <template #privacy>
        <BaseLink :to="privacyPolicyUrl" inline>
          {{ t('legal.privacy.title') }}
        </BaseLink>
      </template>
      <template #terms>
        <BaseLink :to="termsUrl" inline>
          {{ t('legal.terms.title') }}
        </BaseLink>
      </template>
    </i18n-t>
  </BaseCheckbox>
</template>
