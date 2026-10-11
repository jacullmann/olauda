import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { apiErrorMessage, apiErrorStatus } from '@/api/errors';
import { useCooldown } from '@/common/composables/useCooldown';
import type { ForgotPasswordErrors } from '@/modules/auth/types';
import {
  EMAIL_CODE_LENGTH,
  RESEND_COOLDOWN_MS,
} from '@/modules/auth/utils/emailCode';
import { isStrongPassword } from '@/modules/auth/utils/password';

const BAD_REQUEST = 400;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ForgotPasswordStep = 'email' | 'code' | 'password';

interface VerifyResetCodeResponse {
  resetToken: string;
}

export function useForgotPassword(
  initialEmail: string,
  onReset: (email: string) => Promise<void>,
) {
  const { t } = useI18n();
  // Every request replaces the previous code and sends another email, so a
  // client-side pause keeps impatient users from invalidating codes in flight.
  const cooldown = useCooldown(RESEND_COOLDOWN_MS);

  const step = ref<ForgotPasswordStep>('email');
  const email = ref(initialEmail);
  const code = ref('');
  const password = ref('');
  const password2 = ref('');
  const submitting = ref(false);
  const error = ref('');
  const errors = reactive<ForgotPasswordErrors>({});
  const cooldownEmail = ref('');
  let resetToken = '';

  const normalizedEmail = computed(() => email.value.trim().toLowerCase());

  const cooldownSeconds = computed(() =>
    cooldownEmail.value === normalizedEmail.value
      ? cooldown.secondsLeft.value
      : 0,
  );

  function clearErrors() {
    error.value = '';
    Object.assign(errors, {
      email: undefined,
      code: undefined,
      password: undefined,
      confirm: undefined,
    });
  }

  function clearFieldError(field: keyof ForgotPasswordErrors) {
    errors[field] = undefined;
    error.value = '';
  }

  async function guarded(action: () => Promise<void>) {
    if (submitting.value) return;
    clearErrors();
    submitting.value = true;
    try {
      await action();
    } finally {
      submitting.value = false;
    }
  }

  async function requestCode() {
    if (!EMAIL_PATTERN.test(normalizedEmail.value)) {
      errors.email = t('auth.errors.email_invalid');
      return;
    }
    if (cooldownSeconds.value > 0) return;
    try {
      await api.post('/auth/forgot', { email: normalizedEmail.value });
      cooldownEmail.value = normalizedEmail.value;
      cooldown.start();
      code.value = '';
      step.value = 'code';
    } catch (e: unknown) {
      error.value = apiErrorMessage(e, t('auth.errors.send_code'));
    }
  }

  async function verifyCode() {
    if (code.value.length !== EMAIL_CODE_LENGTH) {
      errors.code = t('auth.errors.code_missing');
      return;
    }
    try {
      const { data } = await api.post<VerifyResetCodeResponse>(
        '/auth/reset/verify',
        { email: normalizedEmail.value, code: code.value },
      );
      resetToken = data.resetToken;
      step.value = 'password';
    } catch (e: unknown) {
      error.value = apiErrorMessage(e, t('auth.errors.code_invalid'));
    }
  }

  function validatePassword(): boolean {
    errors.password = isStrongPassword(password.value)
      ? undefined
      : t('auth.errors.new_password_weak');
    errors.confirm =
      password.value !== password2.value
        ? t('auth.errors.confirm_mismatch')
        : undefined;
    return !errors.password && !errors.confirm;
  }

  function startOverExpired() {
    resetToken = '';
    step.value = 'email';
    error.value = t('auth.login.reset.errors.expired');
  }

  async function resetPassword() {
    if (!validatePassword()) return;
    if (!resetToken) {
      startOverExpired();
      return;
    }
    try {
      await api.post('/auth/reset', { resetToken, password: password.value });
    } catch (e: unknown) {
      // The password passed the same checks as on the server, so a refusal
      // means the reset token ran out.
      if (apiErrorStatus(e) === BAD_REQUEST) startOverExpired();
      else error.value = apiErrorMessage(e, t('auth.login.reset.errors.reset'));
      return;
    }
    await onReset(normalizedEmail.value);
  }

  const stepActions: Record<ForgotPasswordStep, () => Promise<void>> = {
    email: requestCode,
    code: verifyCode,
    password: resetPassword,
  };

  function submit() {
    return guarded(stepActions[step.value]);
  }

  function resendCode() {
    return guarded(requestCode);
  }

  function backToEmail() {
    step.value = 'email';
    code.value = '';
    clearErrors();
  }

  return {
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
  };
}
