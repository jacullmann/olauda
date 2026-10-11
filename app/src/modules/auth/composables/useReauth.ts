import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from '@simplewebauthn/browser';
import api from '@/api/api';
import { apiErrorCode, retryAfterMinutes } from '@/api/errors';
import { mfaErrorMessage } from '@/modules/auth/composables/useMfa';
import type {
  PasskeyChallengeResponse,
  ReauthStatus,
} from '@/modules/auth/types';
import { AuthErrorCode } from '@/modules/auth/utils/authErrors';
import {
  isPasskeyDismissed,
  passkeyErrorMessage,
} from '@/modules/auth/utils/passkeyErrors';
import { saveReauthReturn } from '@/modules/auth/utils/reauthReturn';
import {
  emptySecondFactor,
  secondFactorProof,
} from '@/modules/auth/utils/secondFactor';
import type { ReauthStep } from '@/stores/modalStore';

const ERROR_KEYS: Record<string, string> = {
  INCORRECT_PASSWORD: 'auth.errors.password_wrong',
  SECOND_FACTOR_REQUIRED: 'auth.reauth.errors.second_factor_missing',
};

/**
 * Confirms who the user is before a sensitive action, with any way the
 * account can sign in. `onConfirmed` runs once the server accepted it.
 */
export function useReauth(step: Ref<ReauthStep>, onConfirmed: () => void) {
  const { t } = useI18n();
  const router = useRouter();

  const status = ref<ReauthStatus | null>(null);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref('');
  const password = ref('');
  const secondFactor = ref(emptySecondFactor());

  const methods = computed(() => status.value?.methods ?? null);
  const proof = computed(() => secondFactorProof(secondFactor.value));
  const needsSecondFactor = computed(
    () => step.value === 'google-second-factor' || !!methods.value?.twoFactor,
  );
  const passkeysUsable = computed(
    () => (methods.value?.passkeys ?? 0) > 0 && browserSupportsWebAuthn(),
  );
  const passwordReady = computed(
    () =>
      password.value.length > 0 && (!needsSecondFactor.value || !!proof.value),
  );

  function errorMessage(
    err: unknown,
    fallbackKey = 'auth.reauth.errors.confirm',
  ): string {
    const code = apiErrorCode(err);
    if (code === AuthErrorCode.ReauthLocked) {
      return t('auth.errors.reauth_locked', retryAfterMinutes(err));
    }
    const key = code ? ERROR_KEYS[code] : undefined;
    if (key) return t(key);
    return mfaErrorMessage(err, fallbackKey);
  }

  async function attempt(request: () => Promise<unknown>): Promise<void> {
    if (submitting.value) return;
    submitting.value = true;
    error.value = '';
    try {
      await request();
      onConfirmed();
    } catch (err: unknown) {
      error.value = errorMessage(err);
      secondFactor.value = emptySecondFactor(secondFactor.value.mode);
    } finally {
      submitting.value = false;
    }
  }

  /** Another tab may have confirmed meanwhile; then nothing is asked. */
  async function load(): Promise<void> {
    loading.value = true;
    error.value = '';
    password.value = '';
    secondFactor.value = emptySecondFactor();
    try {
      const { data } = await api.get<ReauthStatus>('/auth/reauth');
      status.value = data;
      if (data.recentUntil && step.value === 'choose') onConfirmed();
    } catch {
      error.value = t('auth.reauth.errors.load');
    } finally {
      loading.value = false;
    }
  }

  const confirmWithPassword = () =>
    attempt(() =>
      api.post('/auth/reauth/password', {
        password: password.value,
        secondFactor: needsSecondFactor.value ? proof.value : undefined,
      }),
    );

  const confirmGoogleSecondFactor = () =>
    attempt(() => api.post('/auth/reauth/google/second-factor', proof.value));

  async function confirmWithPasskey(): Promise<void> {
    if (submitting.value) return;
    submitting.value = true;
    error.value = '';
    try {
      const { data } = await api.post<PasskeyChallengeResponse>(
        '/auth/reauth/passkey/start',
      );
      const credential = await startAuthentication({
        optionsJSON: data.options,
      });
      await api.post('/auth/reauth/passkey/finish', {
        challengeId: data.challengeId,
        credential,
      });
      onConfirmed();
    } catch (err: unknown) {
      if (!isPasskeyDismissed(err)) {
        error.value = passkeyErrorMessage(err, 'auth.passkeys.errors.confirm');
      }
    } finally {
      submitting.value = false;
    }
  }

  /**
   * Leaves for Google. The action that asked is lost with the page, so the
   * user is brought back to where they were and repeats it.
   */
  async function confirmWithGoogle(): Promise<void> {
    if (submitting.value) return;
    submitting.value = true;
    error.value = '';
    try {
      const { data } = await api.post<{ url: string }>(
        '/auth/reauth/google/start',
      );
      saveReauthReturn(router.currentRoute.value.fullPath);
      window.location.assign(data.url);
    } catch (err: unknown) {
      error.value = errorMessage(err, 'auth.reauth.errors.google');
      submitting.value = false;
    }
  }

  return {
    methods,
    loading,
    submitting,
    error,
    password,
    secondFactor,
    proof,
    needsSecondFactor,
    passkeysUsable,
    passwordReady,
    load,
    confirmWithPassword,
    confirmWithPasskey,
    confirmWithGoogle,
    confirmGoogleSecondFactor,
  };
}
