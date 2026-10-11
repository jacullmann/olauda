<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AuthGoogleIcon from './AuthGoogleIcon.vue';
import AuthTermsCheckbox from './AuthTermsCheckbox.vue';
import { useOAuth } from '@/modules/auth/composables/useOAuth';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'signed-up'): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const { signUpWithGoogle } = useOAuth();

const acceptedTerms = ref(false);
const submitting = ref(false);
const errorMsg = ref('');

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    acceptedTerms.value = false;
    errorMsg.value = '';
  },
);

async function submit() {
  if (!acceptedTerms.value || submitting.value) return;
  submitting.value = true;
  errorMsg.value = '';

  const result = await signUpWithGoogle();

  submitting.value = false;

  if (result.ok) {
    emit('signed-up');
  } else {
    errorMsg.value = result.error;
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="submit"
    :loading="submitting"
    :error="errorMsg"
    :requirement="acceptedTerms"
    :close-button="false"
    @cancel="emit('cancel')"
  >
    <template #title>{{ t('auth.google_signup.title') }}</template>

    <template #content>
      <div class="flex flex-col items-center my-4">
        <AuthGoogleIcon :size="40" />
      </div>

      <div class="text-sm text-on-ghost-muted">
        {{ t('auth.google_signup.description') }}
      </div>

      <AuthTermsCheckbox v-model="acceptedTerms" class="mb-4" />
    </template>

    <template #action-text>
      {{ t('auth.google_signup.action') }}
    </template>
  </BaseModal>
</template>
