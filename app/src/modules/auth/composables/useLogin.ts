import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useMfa } from './useMfa';
import type { SignUpCredentials } from './useConfirmSignUp';
import { apiErrorCode } from '@/api/errors';
import {
  AuthErrorCode,
  authErrorMessage,
} from '@/modules/auth/utils/authErrors';

/** Subset of `BaseInput`'s exposed API that these forms rely on. */
interface FocusableInput {
  focus: () => void;
}

export function useLogin(
  onLoggedIn: () => void | Promise<void>,
  onMfaRequired: () => void | Promise<void>,
) {
  const { t } = useI18n();
  const { resetMfaState } = useMfa();

  const email = ref('');
  const password = ref('');
  const submitting = ref(false);
  const formError = ref('');
  /** A sign-up with these credentials still waits for its emailed code. */
  const unconfirmedSignUp = ref<SignUpCredentials | null>(null);

  const emailInputRef = ref<FocusableInput | null>(null);

  const errors = reactive<{
    email?: string;
    password?: string;
  }>({});

  onMounted(() => {
    emailInputRef.value?.focus();
  });

  function clearAllErrors() {
    errors.email = undefined;
    errors.password = undefined;
  }

  function clearFieldError(field: 'email' | 'password') {
    errors[field] = undefined;
    formError.value = '';
  }

  function validateBeforeSubmit(): boolean {
    clearAllErrors();
    let ok = true;

    if (!email.value?.trim()) {
      errors.email = t('auth.errors.email_missing');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      errors.email = t('auth.errors.email_invalid');
      ok = false;
    }

    if (!password.value) {
      errors.password = t('auth.errors.password_missing');
      ok = false;
    }

    return ok;
  }

  async function submit() {
    formError.value = '';

    if (!validateBeforeSubmit()) {
      return;
    }

    submitting.value = true;
    try {
      const { data } = await api.post('/auth/login', {
        email: email.value,
        password: password.value,
      });

      if (data.ok) {
        if (data.requiresMfa) {
          resetMfaState();
          void onMfaRequired();
        } else {
          void onLoggedIn();
        }
      }
    } catch (e: unknown) {
      if (apiErrorCode(e) === AuthErrorCode.EmailNotVerified) {
        unconfirmedSignUp.value = {
          email: email.value.trim(),
          password: password.value,
        };
      } else {
        formError.value = authErrorMessage(e, t('auth.errors.sign_in'));
      }
    } finally {
      submitting.value = false;
    }
  }

  return {
    email,
    password,
    submitting,
    formError,
    emailInputRef,
    errors,
    unconfirmedSignUp,

    clearFieldError,
    submit,
  };
}
