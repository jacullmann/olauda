<script setup lang="ts">
import { computed, useTemplateRef, watchPostEffect } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useToast } from '@/common/composables/useToast';
import CenteredAuthModal from '@/common/components/CenteredAuthModal.vue';
import { useUserStore } from '@/stores/userStore';
import { useLogout } from '@/core/composables/useLogout';
import {
  type ForgotPasswordStep,
  useForgotPassword,
} from '@/modules/auth/composables/useForgotPassword';

const router = useRouter();
const { t } = useI18n();
const toast = useToast();
const { user } = storeToRefs(useUserStore());
const logout = useLogout();

const {
  step,
  email,
  code,
  password,
  password2,
  submitting,
  error,
  errors,
  cooldownSeconds,
  clearFieldError,
  submit,
  resendCode,
  backToEmail,
} = useForgotPassword(user.value?.email ?? '', onPasswordReset);

const stepInput = useTemplateRef<{ focus: () => void }>('stepInput');
watchPostEffect(() => stepInput.value?.focus());

const titles = computed<Record<ForgotPasswordStep, string>>(() => ({
  email: t('auth.login.reset.title'),
  code: t('auth.login.reset.step2.title'),
  password: t('auth.login.reset.step3.title'),
}));

const submitLabel = computed(() => {
  if (step.value === 'code') return t('auth.login.reset.actions.verify_code');
  if (step.value === 'password') {
    return t('auth.login.reset.actions.set_password');
  }
  return cooldownSeconds.value > 0
    ? t('auth.login.reset.actions.resend_code_in', {
        seconds: cooldownSeconds.value,
      })
    : t('auth.login.reset.actions.request_code');
});

const resendLabel = computed(() =>
  cooldownSeconds.value > 0
    ? t('auth.login.reset.actions.resend_code_in', {
        seconds: cooldownSeconds.value,
      })
    : t('auth.login.reset.actions.resend_code'),
);

// Signed-in users arrive from their account settings and return there.
function exitPage() {
  return router.push(
    user.value
      ? { name: 'account-settings', params: { tab: 'security' } }
      : { name: 'login' },
  );
}

function leave() {
  if (!submitting.value) void exitPage();
}

async function onPasswordReset(resetEmail: string) {
  toast.success(t('auth.login.reset.success.reset'));
  // A reset revokes every session of that account, so resetting your
  // own signs you out here as well.
  if (user.value?.email.toLowerCase() === resetEmail) {
    await logout();
  } else {
    await exitPage();
  }
}
</script>

<template>
  <CenteredAuthModal
    :title="titles[step]"
    :close-on-backdrop="false"
    @close="leave"
  >
    <BaseForm
      :submit="submit"
      :cancel="leave"
      :error="error"
      :loading="submitting"
      :requirement="step !== 'email' || cooldownSeconds === 0"
    >
      <template #content>
        <template v-if="step === 'email'">
          <p class="mx-0! my-0!">
            {{ t('auth.login.reset.step1.description') }}
          </p>
          <BaseFormGroup id="reset-email" :error="errors.email">
            <BaseLabel for="reset-email">
              {{ t('auth.login.email') }}
            </BaseLabel>
            <BaseInput
              id="reset-email"
              ref="stepInput"
              v-model="email"
              :placeholder="t('auth.login.reset.placeholders.email')"
              type="email"
              autocomplete="email"
              required
              :aria-describedby="errors.email ? 'reset-email-error' : undefined"
              @input="clearFieldError('email')"
            />
          </BaseFormGroup>
        </template>

        <template v-else-if="step === 'code'">
          <p class="mx-0! my-0!">
            {{ t('auth.login.reset.code_sent') }}
            {{ t('auth.login.reset.step2.description') }}
          </p>
          <BaseFormGroup id="reset-code" :error="errors.code">
            <BaseCodeInput
              id="reset-code"
              ref="stepInput"
              v-model="code"
              :aria-label="t('auth.login.reset.placeholders.code')"
              :invalid="!!errors.code"
              required
              :aria-describedby="errors.code ? 'reset-code-error' : undefined"
              @input="clearFieldError('code')"
            />
          </BaseFormGroup>
          <BaseButton
            type="button"
            :disabled="submitting || cooldownSeconds > 0"
            @click="resendCode"
          >
            {{ resendLabel }}
          </BaseButton>
        </template>

        <template v-else>
          <p class="mx-0! my-0!">
            {{ t('auth.login.reset.step3.description') }}
          </p>
          <BaseFormGroup id="reset-password" :error="errors.password">
            <BaseLabel for="reset-password">
              {{ t('auth.login.reset.placeholders.new_password') }}
            </BaseLabel>
            <BaseInput
              id="reset-password"
              ref="stepInput"
              v-model="password"
              :placeholder="t('auth.login.reset.placeholders.new_password')"
              type="password"
              autocomplete="new-password"
              required
              :aria-describedby="
                errors.password ? 'reset-password-error' : undefined
              "
              @input="clearFieldError('password')"
            />
          </BaseFormGroup>
          <BaseFormGroup id="reset-password-confirm" :error="errors.confirm">
            <BaseLabel for="reset-password-confirm">
              {{ t('auth.login.reset.placeholders.confirm_password') }}
            </BaseLabel>
            <BaseInput
              id="reset-password-confirm"
              v-model="password2"
              :placeholder="t('auth.login.reset.placeholders.confirm_password')"
              type="password"
              autocomplete="new-password"
              required
              :aria-describedby="
                errors.confirm ? 'reset-password-confirm-error' : undefined
              "
              @input="clearFieldError('confirm')"
            />
          </BaseFormGroup>
        </template>
      </template>

      <template v-if="step === 'code'" #secondary-action>
        <BaseButton
          type="button"
          surface
          variant="ghost"
          form
          :disabled="submitting"
          @click="backToEmail"
        >
          {{ t('common.buttons.back') }}
        </BaseButton>
      </template>

      <template #action-text>
        {{ submitLabel }}
      </template>
    </BaseForm>
  </CenteredAuthModal>
</template>
