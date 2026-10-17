import api, { unwrap } from '@/api/client';
import i18n from '@/i18n';
import type { MfaChallengeDto, SecondFactorProof } from '@/api/schema';
import {
  apiErrorCode,
  apiErrorMessage,
  isReauthDeclined,
  retryAfterMinutes,
} from '@/api/errors';

export type MfaResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; challengeExpired?: boolean };

export function isMfaChallengeExpired(err: unknown): boolean {
  return apiErrorCode(err) === 'MFA_CHALLENGE_EXPIRED';
}

export function mfaErrorMessage(err: unknown, fallbackKey: string): string {
  const { t } = i18n.global;

  switch (apiErrorCode(err)) {
    case 'MFA_CHALLENGE_EXPIRED':
      return t('auth.errors.session_expired');
    case 'MFA_LOCKED':
      return t('auth.mfa.errors.locked', retryAfterMinutes(err));
    case 'INVALID_SECOND_FACTOR':
      return t('auth.mfa.errors.code_invalid');
  }
  return apiErrorMessage(err, t(fallbackKey));
}

/** A declined confirmation is the user's choice and shows no error. */
export function mfaFailure(
  err: unknown,
  fallbackKey: string,
): MfaResult<never> {
  if (isReauthDeclined(err)) return { ok: false };
  return {
    ok: false,
    error: mfaErrorMessage(err, fallbackKey),
    challengeExpired: isMfaChallengeExpired(err),
  };
}

/** The second step of a sign-in, answered with a code. */
export function useMfa() {
  /** Resolves with the recovery codes left when one was used. */
  async function verifyMfaLogin(
    proof: SecondFactorProof,
  ): Promise<MfaResult<{ data: number | null }>> {
    try {
      const { recoveryCodesLeft } = await unwrap(
        api.POST('/auth/mfa/verify', { body: proof }),
      );
      return { ok: true, data: recoveryCodesLeft ?? null };
    } catch (err: unknown) {
      return mfaFailure(err, 'auth.mfa.errors.verify');
    }
  }

  /** The pending sign-in challenge, or `null` if there is none. */
  async function fetchMfaChallenge(): Promise<MfaChallengeDto | null> {
    try {
      return await unwrap(api.GET('/auth/mfa/challenge'));
    } catch (err: unknown) {
      if (isMfaChallengeExpired(err)) return null;
      throw err;
    }
  }

  async function cancelMfaLogin(): Promise<void> {
    try {
      await unwrap(api.POST('/auth/mfa/cancel'));
    } catch {
      // Best-effort cleanup; the pending token expires on its own.
    }
  }

  return { verifyMfaLogin, fetchMfaChallenge, cancelMfaLogin };
}
