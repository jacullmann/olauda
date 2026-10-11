<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  type SignUpCredentials,
  useConfirmSignUp,
} from '@/modules/auth/composables/useConfirmSignUp';
import { EMAIL_CODE_LENGTH } from '@/modules/auth/utils/emailCode';

const props = withDefaults(
  defineProps<{
    credentials: SignUpCredentials;
    /** Right after signing up, the first code is still on its way. */
    codeJustSent?: boolean;
  }>(),
  { codeJustSent: false },
);

const emit = defineEmits<{
  confirmed: [];
  back: [];
}>();

const { t } = useI18n();

const {
  code,
  error,
  submitting,
  resending,
  cooldownSeconds,
  clearError,
  submit,
  resend,
} = useConfirmSignUp(
  props.credentials,
  { codeJustSent: props.codeJustSent },
  () => emit('confirmed'),
);

const codeInput = useTemplateRef<{ focus: () => void }>('codeInput');
onMounted(() => codeInput.value?.focus());

const resendLabel = computed(() =>
  cooldownSeconds.value > 0
    ? t('auth.login.reset.actions.resend_code_in', {
        seconds: cooldownSeconds.value,
      })
    : t('auth.login.reset.actions.resend_code'),
);
</script>

<template>
  <div class="w-full max-w-105">
    <div class="text-center mb-8">
      <h1 class="text-center!">
        {{ t('auth.verify_email.title') }}
      </h1>
      <i18n-t
        keypath="auth.verify_email.description"
        tag="p"
        class="text-sm text-on-ghost-muted mt-1!"
      >
        <template #email>
          <span class="font-medium text-on-ghost wrap-anywhere">
            {{ props.credentials.email }}
          </span>
        </template>
      </i18n-t>
    </div>

    <BaseForm
      :submit="submit"
      :loading="submitting"
      :error="error"
      :requirement="code.length === EMAIL_CODE_LENGTH"
    >
      <template #content>
        <!-- Codes are typed or pasted in one go, so a complete code submits
             without an extra click. -->
        <BaseCodeInput
          id="verify-code"
          ref="codeInput"
          v-model="code"
          :aria-label="t('auth.verify_email.code')"
          :invalid="!!error"
          required
          @input="clearError"
          @complete="submit"
        />
        <BaseButton
          type="button"
          :loading="resending"
          :disabled="submitting || resending || cooldownSeconds > 0"
          @click="resend"
        >
          {{ resendLabel }}
        </BaseButton>
      </template>

      <template #secondary-action>
        <BaseButton
          type="button"
          surface
          variant="ghost"
          form
          :disabled="submitting"
          @click="emit('back')"
        >
          {{ t('common.buttons.back') }}
        </BaseButton>
      </template>

      <template #action-text>
        {{ t('auth.verify_email.submit') }}
      </template>
    </BaseForm>
  </div>
</template>
