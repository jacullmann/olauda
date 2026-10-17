import { describe, expect, it } from 'vitest';
import { WebAuthnError } from '@simplewebauthn/browser';
import { ApiError } from '@/api/errors';
import i18n from '@/i18n';
import { isPasskeyDismissed, passkeyErrorMessage } from './passkeyErrors';

const FALLBACK = 'auth.passkeys.errors.sign_in';
const { t } = i18n.global;

const apiError = (status: number, body: unknown) => new ApiError(status, body);

function browserError(
  name: string,
  code: WebAuthnError['code'],
): WebAuthnError {
  const cause = new Error('browser said no');
  cause.name = name;
  return new WebAuthnError({ message: cause.message, code, cause });
}

describe('isPasskeyDismissed', () => {
  it('treats a closed dialog, a timeout and a replaced ceremony as dismissed', () => {
    expect(
      isPasskeyDismissed(
        browserError('NotAllowedError', 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'),
      ),
    ).toBe(true);
    expect(
      isPasskeyDismissed(browserError('AbortError', 'ERROR_CEREMONY_ABORTED')),
    ).toBe(true);
  });

  it('reports failures the user did not choose', () => {
    expect(
      isPasskeyDismissed(browserError('SecurityError', 'ERROR_INVALID_RP_ID')),
    ).toBe(false);
    expect(isPasskeyDismissed(apiError(401, {}))).toBe(false);
  });
});

describe('passkeyErrorMessage', () => {
  it('explains each server refusal by its code', () => {
    const err = apiError(401, {
      error: 'This passkey is not registered.',
      code: 'PASSKEY_UNKNOWN',
    });
    expect(passkeyErrorMessage(err, FALLBACK)).toBe(
      t('auth.passkeys.errors.not_registered'),
    );
  });

  it('recognises a passkey that already exists on this device', () => {
    const err = browserError(
      'InvalidStateError',
      'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
    );
    expect(passkeyErrorMessage(err, FALLBACK)).toBe(
      t('auth.passkeys.errors.already_on_device'),
    );
  });

  it('recognises the plain-text rate limit answer', () => {
    expect(
      passkeyErrorMessage(apiError(429, 'Too Many Requests'), FALLBACK),
    ).toBe(t('common.errors.rate_limited'));
  });

  it('falls back for anything else', () => {
    expect(passkeyErrorMessage(new Error('offline'), FALLBACK)).toBe(
      t(FALLBACK),
    );
  });
});
