import i18n from '@/i18n';
import {
  apiErrorCode,
  apiErrorMessage,
  isReauthDeclined,
  retryAfterMinutes,
} from '@/api/errors';
import type { ErrorCode } from '@/api/schema';

/** The failures of signing in or changing sign-in methods the user can act on. */
const MESSAGE_KEYS: Partial<Record<ErrorCode, string>> = {
  INVALID_CREDENTIALS: 'auth.errors.invalid_credentials',
  EMAIL_ALREADY_REGISTERED: 'auth.errors.email_taken',
  EMAIL_CODE_THROTTLED: 'auth.errors.email_throttled',
  LAST_SIGN_IN_METHOD: 'auth.errors.last_sign_in_method',
  REGISTRATION_PAUSED: 'auth.errors.registration_paused',
  SHUTDOWN: 'auth.errors.shutdown',
  RATE_LIMITED: 'common.errors.rate_limited',
};

/**
 * The message for a failed auth request in the user's language. Empty when
 * the user declined to confirm who they are: that was their choice.
 */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (isReauthDeclined(err)) return '';
  const code = apiErrorCode(err);
  if (code === 'LOGIN_LOCKED') {
    return i18n.global.t('auth.errors.login_locked', retryAfterMinutes(err));
  }
  const key = code && MESSAGE_KEYS[code];
  return key ? i18n.global.t(key) : apiErrorMessage(err, fallback);
}
