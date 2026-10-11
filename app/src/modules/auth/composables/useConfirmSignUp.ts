import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api.ts';
import { apiErrorCode, apiErrorStatus } from '@/api/errors';
import { useCooldown } from '@/common/composables/useCooldown';
import { useToast } from '@/common/composables/useToast';
import {
  AuthErrorCode,
  authErrorMessage,
} from '@/modules/auth/utils/authErrors';
import {
  EMAIL_CODE_LENGTH,
  RESEND_COOLDOWN_MS,
} from '@/modules/auth/utils/emailCode';

const BAD_REQUEST = 400;

/** What was entered when signing up, which confirming it repeats. */
export interface SignUpCredentials {
  email: string;
  password: string;
}

/**
 * Confirms a sign-up with the code mailed to its address. The account only
 * comes into being once the password chosen at sign-up comes along, so the
 * code alone, or the password alone, cannot claim it.
 */
export function useConfirmSignUp(
  credentials: SignUpCredentials,
  { codeJustSent }: { codeJustSent: boolean },
  onSignedIn: () => void | Promise<void>,
) {
  const { t } = useI18n();
  const toast = useToast();
  const cooldown = useCooldown(RESEND_COOLDOWN_MS);

  const code = ref('');
  const error = ref('');
  const submitting = ref(false);
  const resending = ref(false);

  if (codeJustSent) cooldown.start();

  function clearError() {
    error.value = '';
  }

  function confirmError(e: unknown): string {
    const errorCode = apiErrorCode(e);
    if (errorCode === AuthErrorCode.IncorrectPassword) {
      return t('auth.verify_email.errors.incorrect_password');
    }
    if (!errorCode && apiErrorStatus(e) === BAD_REQUEST) {
      return t('auth.errors.code_invalid');
    }
    return authErrorMessage(e, t('auth.verify_email.errors.verify'));
  }

  async function submit() {
    if (submitting.value) return;
    clearError();
    if (code.value.length !== EMAIL_CODE_LENGTH) {
      error.value = t('auth.errors.code_missing');
      return;
    }

    submitting.value = true;
    try {
      await api.post('/auth/verify', { ...credentials, code: code.value });
      await onSignedIn();
    } catch (e: unknown) {
      error.value = confirmError(e);
    } finally {
      submitting.value = false;
    }
  }

  /** The answer is the same whether or not a mail went out. */
  async function resend() {
    if (resending.value || cooldown.secondsLeft.value > 0) return;
    clearError();

    resending.value = true;
    try {
      await api.post('/auth/verify/resend', { email: credentials.email });
      cooldown.start();
      code.value = '';
      toast.success(t('auth.verify_email.resent'));
    } catch (e: unknown) {
      error.value = authErrorMessage(e, t('auth.errors.send_code'));
    } finally {
      resending.value = false;
    }
  }

  return {
    code,
    error,
    submitting,
    resending,
    cooldownSeconds: cooldown.secondsLeft,
    clearError,
    submit,
    resend,
  };
}
