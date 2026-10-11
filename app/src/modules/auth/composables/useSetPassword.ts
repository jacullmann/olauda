import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api.ts';
import type { SetPasswordErrors } from '@/modules/auth/types';
import { useUserStore } from '@/stores/userStore';
import { apiErrorStatus } from '@/api/errors';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import { EMAIL_CODE_LENGTH } from '@/modules/auth/utils/emailCode';
import { isStrongPassword } from '@/modules/auth/utils/password';

const BAD_REQUEST = 400;

type SetPasswordStep = 'request' | 'confirm';

/**
 * A Google-only account sets its first password by proving control of its
 * email with a code, without the side effects of a password reset.
 */
export function useSetPassword(onSuccess: () => void) {
  const { t } = useI18n();
  const userStore = useUserStore();

  const step = ref<SetPasswordStep>('request');
  const code = ref('');
  const newPassword = ref('');
  const newPassword2 = ref('');
  const submitting = ref(false);
  const error = ref('');
  const errors = reactive<SetPasswordErrors>({});

  function clearFieldError(field: keyof SetPasswordErrors) {
    errors[field] = undefined;
    error.value = '';
  }

  function validate(): boolean {
    errors.code =
      code.value.length === EMAIL_CODE_LENGTH
        ? undefined
        : t('auth.errors.code_missing');

    if (!newPassword.value) {
      errors.new = t('auth.errors.new_password_missing');
    } else if (!isStrongPassword(newPassword.value)) {
      errors.new = t('auth.errors.new_password_weak');
    } else {
      errors.new = undefined;
    }

    if (!newPassword2.value) {
      errors.confirm = t('auth.errors.confirm_missing');
    } else if (newPassword.value !== newPassword2.value) {
      errors.confirm = t('auth.errors.confirm_mismatch');
    } else {
      errors.confirm = undefined;
    }

    return !errors.code && !errors.new && !errors.confirm;
  }

  async function requestCode() {
    try {
      await api.post('/auth/set-password/code');
      step.value = 'confirm';
    } catch (e: unknown) {
      error.value = authErrorMessage(e, t('auth.errors.send_code'));
    }
  }

  async function setPassword() {
    if (!validate()) return;

    try {
      await api.post('/auth/set-password', {
        code: code.value,
        newPassword: newPassword.value,
      });
      userStore.updateUser({ hasPassword: true });
      onSuccess();
    } catch (e: unknown) {
      // The password passed the same checks as on the server, so a refusal
      // can only be the code.
      error.value =
        apiErrorStatus(e) === BAD_REQUEST
          ? t('auth.errors.code_invalid')
          : authErrorMessage(e, t('auth.set_password.errors.set'));
    }
  }

  async function submit() {
    if (submitting.value) return;
    error.value = '';
    submitting.value = true;
    try {
      await (step.value === 'request' ? requestCode() : setPassword());
    } finally {
      submitting.value = false;
    }
  }

  return {
    step,
    code,
    newPassword,
    newPassword2,
    submitting,
    error,
    errors,
    clearFieldError,
    submit,
  };
}
