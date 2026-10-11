import { WebAuthnError } from '@simplewebauthn/browser';
import i18n from '@/i18n';
import { apiErrorCode, apiErrorMessage, isReauthDeclined } from '@/api/errors';
import { AuthErrorCode } from '@/modules/auth/utils/authErrors';

/** Codes the API sends when a passkey ceremony fails. */
export const PasskeyErrorCode = {
  ChallengeExpired: 'PASSKEY_CHALLENGE_EXPIRED',
  Unknown: 'PASSKEY_UNKNOWN',
  Rejected: 'PASSKEY_REJECTED',
  RegistrationRejected: 'PASSKEY_REGISTRATION_REJECTED',
  AlreadyRegistered: 'PASSKEY_ALREADY_REGISTERED',
  LimitReached: 'PASSKEY_LIMIT_REACHED',
} as const;

const MESSAGE_KEYS: Record<string, string> = {
  [PasskeyErrorCode.ChallengeExpired]: 'auth.passkeys.errors.expired',
  [PasskeyErrorCode.Unknown]: 'auth.passkeys.errors.not_registered',
  [PasskeyErrorCode.Rejected]: 'auth.passkeys.errors.rejected',
  [PasskeyErrorCode.RegistrationRejected]: 'auth.passkeys.errors.rejected',
  [PasskeyErrorCode.AlreadyRegistered]:
    'auth.passkeys.errors.already_registered',
  [PasskeyErrorCode.LimitReached]: 'auth.passkeys.errors.limit_reached',
  [AuthErrorCode.LastSignInMethod]: 'auth.errors.last_sign_in_method',
  [AuthErrorCode.Shutdown]: 'auth.errors.shutdown',
};

/**
 * Whether the user closed the browser's passkey dialog, it timed out, or a
 * newer ceremony replaced it. Browsers report all of these alike on purpose,
 * so a site cannot tell whether a passkey exists; none of them is an error
 * worth showing. Neither is declining to confirm who they are first.
 */
export function isPasskeyDismissed(err: unknown): boolean {
  return (
    isReauthDeclined(err) ||
    (err instanceof Error &&
      (err.name === 'NotAllowedError' || err.name === 'AbortError'))
  );
}

export function passkeyErrorMessage(err: unknown, fallbackKey: string): string {
  const { t } = i18n.global;

  if (
    err instanceof WebAuthnError &&
    err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'
  ) {
    return t('auth.passkeys.errors.already_on_device');
  }

  const key = MESSAGE_KEYS[apiErrorCode(err) ?? ''];
  return key ? t(key) : apiErrorMessage(err, t(fallbackKey));
}
