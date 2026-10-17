import { WebAuthnError } from '@simplewebauthn/browser';
import i18n from '@/i18n';
import { apiErrorCode, apiErrorMessage, isReauthDeclined } from '@/api/errors';
import type { ErrorCode } from '@/api/schema';

/** The failures of a passkey ceremony the user can act on. */
const MESSAGE_KEYS: Partial<Record<ErrorCode, string>> = {
  PASSKEY_CHALLENGE_EXPIRED: 'auth.passkeys.errors.expired',
  PASSKEY_UNKNOWN: 'auth.passkeys.errors.not_registered',
  PASSKEY_REJECTED: 'auth.passkeys.errors.rejected',
  PASSKEY_REGISTRATION_REJECTED: 'auth.passkeys.errors.rejected',
  PASSKEY_ALREADY_REGISTERED: 'auth.passkeys.errors.already_registered',
  PASSKEY_LIMIT_REACHED: 'auth.passkeys.errors.limit_reached',
  LAST_SIGN_IN_METHOD: 'auth.errors.last_sign_in_method',
  SHUTDOWN: 'auth.errors.shutdown',
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

  const code = apiErrorCode(err);
  const key = code && MESSAGE_KEYS[code];
  return key ? t(key) : apiErrorMessage(err, t(fallbackKey));
}
