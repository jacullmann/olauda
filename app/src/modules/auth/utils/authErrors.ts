import i18n from '@/i18n';
import {
  apiErrorCode,
  apiErrorMessage,
  isReauthDeclined,
  retryAfterMinutes,
} from '@/api/errors';

/** Codes the API sends when signing in or changing sign-in methods fails. */
export const AuthErrorCode = {
  InvalidCredentials: 'INVALID_CREDENTIALS',
  LoginLocked: 'LOGIN_LOCKED',
  EmailAlreadyRegistered: 'EMAIL_ALREADY_REGISTERED',
  EmailNotVerified: 'EMAIL_NOT_VERIFIED',
  IncorrectPassword: 'INCORRECT_PASSWORD',
  ReauthLocked: 'REAUTH_LOCKED',
  EmailThrottled: 'EMAIL_CODE_THROTTLED',
  LastSignInMethod: 'LAST_SIGN_IN_METHOD',
  RegistrationPaused: 'REGISTRATION_PAUSED',
  Shutdown: 'SHUTDOWN',
  RateLimited: 'RATE_LIMITED',
} as const;

const MESSAGE_KEYS: Record<string, string> = {
  [AuthErrorCode.InvalidCredentials]: 'auth.errors.invalid_credentials',
  [AuthErrorCode.EmailAlreadyRegistered]: 'auth.errors.email_taken',
  [AuthErrorCode.EmailThrottled]: 'auth.errors.email_throttled',
  [AuthErrorCode.LastSignInMethod]: 'auth.errors.last_sign_in_method',
  [AuthErrorCode.RegistrationPaused]: 'auth.errors.registration_paused',
  [AuthErrorCode.Shutdown]: 'auth.errors.shutdown',
  [AuthErrorCode.RateLimited]: 'common.errors.rate_limited',
};

/**
 * The message for a failed auth request in the user's language. Empty when
 * the user declined to confirm who they are: that was their choice.
 */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (isReauthDeclined(err)) return '';
  const code = apiErrorCode(err);
  if (code === AuthErrorCode.LoginLocked) {
    return i18n.global.t('auth.errors.login_locked', retryAfterMinutes(err));
  }
  const key = MESSAGE_KEYS[code ?? ''];
  return key ? i18n.global.t(key) : apiErrorMessage(err, fallback);
}
