import { ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api.ts';
import type { ChangePasswordErrors } from '@/modules/auth/types';
import { apiErrorCode, apiErrorMessage, retryAfterMinutes } from '@/api/errors';
import { AuthErrorCode } from '@/modules/auth/utils/authErrors';
import {
  isStrongPassword,
  MIN_PASSWORD_LENGTH,
} from '@/modules/auth/utils/password';

export function useChangePassword(onSuccess: () => void) {
  const { t } = useI18n();

  const currentPassword = ref('');
  const newPassword = ref('');
  const newPassword2 = ref('');

  const submitting = ref(false);
  const error = ref('');

  const errors = reactive<ChangePasswordErrors>({});

  function clearAllErrors() {
    errors.current = undefined;
    errors.new = undefined;
    errors.confirm = undefined;
  }

  function clearFieldError(field: 'current' | 'new' | 'confirm') {
    errors[field] = undefined;
    error.value = '';
  }

  function validateBeforeSubmit(): boolean {
    clearAllErrors();
    let ok = true;

    if (!currentPassword.value) {
      errors.current = t('auth.change_password.errors.current_missing');
      ok = false;
    } else if (currentPassword.value.length < MIN_PASSWORD_LENGTH) {
      errors.current = t('auth.errors.password_too_short');
      ok = false;
    }

    if (!newPassword.value) {
      errors.new = t('auth.errors.new_password_missing');
      ok = false;
    } else if (!isStrongPassword(newPassword.value)) {
      errors.new = t('auth.errors.new_password_weak');
      ok = false;
    }

    if (!newPassword2.value) {
      errors.confirm = t('auth.errors.confirm_missing');
      ok = false;
    } else if (newPassword.value !== newPassword2.value) {
      errors.confirm = t('auth.errors.confirm_mismatch');
      ok = false;
    }

    if (ok && currentPassword.value === newPassword.value) {
      errors.new = t('auth.change_password.errors.new_password_unchanged');
      ok = false;
    }

    return ok;
  }

  async function submit() {
    error.value = '';
    if (!validateBeforeSubmit()) {
      return;
    }

    submitting.value = true;
    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      });

      onSuccess();
    } catch (e: unknown) {
      switch (apiErrorCode(e)) {
        case AuthErrorCode.IncorrectPassword:
          errors.current = t('auth.errors.password_wrong');
          break;
        case AuthErrorCode.ReauthLocked:
          error.value = t('auth.errors.reauth_locked', retryAfterMinutes(e));
          break;
        default:
          error.value = apiErrorMessage(
            e,
            t('auth.change_password.errors.change'),
          );
      }
    } finally {
      submitting.value = false;
    }
  }

  return {
    currentPassword,
    newPassword,
    newPassword2,
    submitting,
    error,
    errors,
    clearFieldError,
    submit,
  };
}
