import { ref, computed } from 'vue';
import api from '@/api/api.ts';
import i18n from '@/i18n';
import type {
  MfaChallengeResponse,
  MfaLoginResponse,
  MfaSetupResponse,
  MfaStatusResponse,
  RecoveryCodesResponse,
  SecondFactorProof,
} from '@/modules/auth/types';
import {
  apiErrorCode,
  apiErrorMessage,
  isReauthDeclined,
  retryAfterMinutes,
} from '@/api/errors';

type MfaResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; challengeExpired?: boolean };

const MFA_CHALLENGE_EXPIRED = 'MFA_CHALLENGE_EXPIRED';
const MFA_LOCKED = 'MFA_LOCKED';
const INVALID_SECOND_FACTOR = 'INVALID_SECOND_FACTOR';

export function isMfaChallengeExpired(err: unknown): boolean {
  return apiErrorCode(err) === MFA_CHALLENGE_EXPIRED;
}

export function mfaErrorMessage(err: unknown, fallbackKey: string): string {
  const { t } = i18n.global;

  switch (apiErrorCode(err)) {
    case MFA_CHALLENGE_EXPIRED:
      return t('auth.errors.session_expired');
    case MFA_LOCKED:
      return t('auth.mfa.errors.locked', retryAfterMinutes(err));
    case INVALID_SECOND_FACTOR:
      return t('auth.mfa.errors.code_invalid');
  }
  return apiErrorMessage(err, t(fallbackKey));
}

/** A declined confirmation is the user's choice and shows no error. */
function failure(err: unknown, fallbackKey: string): MfaResult<never> {
  if (isReauthDeclined(err)) return { ok: false };
  return {
    ok: false,
    error: mfaErrorMessage(err, fallbackKey),
    challengeExpired: isMfaChallengeExpired(err),
  };
}

const mfaEnabled = ref(false);
const recoveryCodesLeft = ref<number | null>(null);
const mfaLoading = ref(false);
const mfaError = ref<string | null>(null);

export function useMfa() {
  async function fetchMfaStatus(): Promise<boolean> {
    mfaLoading.value = true;
    mfaError.value = null;

    try {
      const { data } = await api.get<MfaStatusResponse>('/mfa/status');
      mfaEnabled.value = data.mfaEnabled;
      recoveryCodesLeft.value = data.recoveryCodesLeft;
      return data.mfaEnabled;
    } catch (err: unknown) {
      mfaError.value = apiErrorMessage(
        err,
        i18n.global.t('auth.mfa.errors.load'),
      );
      return false;
    } finally {
      mfaLoading.value = false;
    }
  }

  /** `null` when it failed or the user declined to confirm who they are. */
  async function startMfaSetup(): Promise<MfaSetupResponse | null> {
    mfaLoading.value = true;
    mfaError.value = null;

    try {
      const { data } = await api.post<MfaSetupResponse>('/mfa/setup');
      return data;
    } catch (err: unknown) {
      if (!isReauthDeclined(err)) {
        mfaError.value = apiErrorMessage(
          err,
          i18n.global.t('auth.mfa.errors.start_setup'),
        );
      }
      return null;
    } finally {
      mfaLoading.value = false;
    }
  }

  async function run<T>(
    request: () => Promise<T>,
    onSuccess: (data: T) => void,
    fallbackKey: string,
  ): Promise<MfaResult<{ data: T }>> {
    mfaLoading.value = true;
    mfaError.value = null;

    try {
      const data = await request();
      onSuccess(data);
      return { ok: true, data };
    } catch (err: unknown) {
      const result = failure(err, fallbackKey);
      if (!result.ok && result.error) mfaError.value = result.error;
      return result;
    } finally {
      mfaLoading.value = false;
    }
  }

  /** Resolves with the recovery codes, which are shown only this once. */
  const activateMfa = (code: string) =>
    run(
      async () =>
        (await api.post<RecoveryCodesResponse>('/mfa/activate', { code })).data
          .recoveryCodes,
      (codes) => {
        mfaEnabled.value = true;
        recoveryCodesLeft.value = codes.length;
      },
      'auth.mfa.errors.activate',
    );

  const deactivateMfa = () =>
    run(
      () => api.post('/mfa/deactivate'),
      () => {
        mfaEnabled.value = false;
        recoveryCodesLeft.value = null;
      },
      'auth.mfa.errors.deactivate',
    );

  const regenerateRecoveryCodes = () =>
    run(
      async () =>
        (await api.post<RecoveryCodesResponse>('/mfa/recovery-codes')).data
          .recoveryCodes,
      (codes) => {
        recoveryCodesLeft.value = codes.length;
      },
      'auth.mfa.errors.regenerate_codes',
    );

  const verifyMfaLogin = (proof: SecondFactorProof) =>
    run(
      async () =>
        (await api.post<MfaLoginResponse>('/auth/mfa/verify', proof)).data
          .recoveryCodesLeft,
      () => {},
      'auth.mfa.errors.verify',
    );

  /** The pending sign-in challenge, or `null` if there is none. */
  async function fetchMfaChallenge(): Promise<MfaChallengeResponse | null> {
    try {
      const { data } = await api.get<MfaChallengeResponse>(
        '/auth/mfa/challenge',
      );
      return data;
    } catch (err: unknown) {
      if (isMfaChallengeExpired(err)) return null;
      throw err;
    }
  }

  async function cancelMfaLogin(): Promise<void> {
    try {
      await api.post('/auth/mfa/cancel');
    } catch {
      // Best-effort cleanup; the pending token expires on its own.
    }
  }

  function resetMfaState(): void {
    mfaEnabled.value = false;
    recoveryCodesLeft.value = null;
    mfaError.value = null;
  }

  return {
    mfaEnabled: computed(() => mfaEnabled.value),
    recoveryCodesLeft: computed(() => recoveryCodesLeft.value),
    mfaLoading: computed(() => mfaLoading.value),
    mfaError: computed(() => mfaError.value),
    fetchMfaStatus,
    startMfaSetup,
    activateMfa,
    deactivateMfa,
    regenerateRecoveryCodes,
    verifyMfaLogin,
    fetchMfaChallenge,
    cancelMfaLogin,
    resetMfaState,
    setMfaEnabled: (value: boolean) => {
      mfaEnabled.value = value;
    },
  };
}
