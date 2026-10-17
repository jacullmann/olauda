import { ref, reactive, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import api, { unwrap } from '@/api/client';
import { usePreferences } from '@/modules/account/composables/usePreferences';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import { isStrongPassword } from '@/modules/auth/utils/password';
import type { SignUpCredentials } from './useConfirmSignUp';

/** Subset of `BaseInput`'s exposed API that these forms rely on. */
interface FocusableInput {
  focus: () => void;
}

export function useRegister() {
  const { t } = useI18n();
  const { currentTheme, currentLanguage } = usePreferences();

  const email = ref('');
  const password = ref('');
  const passwordConfirm = ref('');
  const acceptedTerms = ref(false);
  const submitting = ref(false);
  const formError = ref('');
  /** Kept until the sign-up is confirmed, which repeats them with the code. */
  const signUp = ref<SignUpCredentials | null>(null);

  const emailInputRef = ref<FocusableInput | null>(null);

  const errors = reactive<{
    email?: string;
    password?: string;
    passwordConfirm?: string;
    terms?: string;
  }>({});

  onMounted(() => {
    emailInputRef.value?.focus();
  });

  function clearAllErrors() {
    errors.email = undefined;
    errors.password = undefined;
    errors.passwordConfirm = undefined;
    errors.terms = undefined;
  }

  function clearFieldError(
    field: 'email' | 'password' | 'passwordConfirm' | 'terms',
  ) {
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
    } else if (!isStrongPassword(password.value)) {
      errors.password = t('auth.errors.new_password_weak');
      ok = false;
    }

    if (!passwordConfirm.value) {
      errors.passwordConfirm = t('auth.errors.confirm_missing');
      ok = false;
    } else if (password.value !== passwordConfirm.value) {
      errors.passwordConfirm = t('auth.errors.confirm_mismatch');
      ok = false;
    }

    if (!acceptedTerms.value) {
      errors.terms = t('auth.login.errors.terms_missing');
      ok = false;
    }

    return ok;
  }

  async function restartRegistration() {
    signUp.value = null;
    acceptedTerms.value = false;
    await nextTick();
    emailInputRef.value?.focus();
  }

  async function submit() {
    formError.value = '';

    if (!validateBeforeSubmit()) {
      return;
    }

    submitting.value = true;
    try {
      await unwrap(
        api.POST('/auth/register', {
          body: {
            email: email.value,
            password: password.value,
            acceptedTerms: acceptedTerms.value,
            preferences: {
              theme: currentTheme.value,
              language: currentLanguage.value,
            },
          },
        }),
      );

      signUp.value = { email: email.value.trim(), password: password.value };
      password.value = '';
      passwordConfirm.value = '';
    } catch (e: unknown) {
      formError.value = authErrorMessage(e, t('auth.errors.sign_up'));
    } finally {
      submitting.value = false;
    }
  }

  return {
    email,
    password,
    passwordConfirm,
    acceptedTerms,
    submitting,
    formError,
    signUp,
    emailInputRef,
    errors,

    clearFieldError,
    restartRegistration,
    submit,
  };
}
