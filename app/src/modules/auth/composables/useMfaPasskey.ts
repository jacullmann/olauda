import { onBeforeUnmount, ref } from 'vue';
import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  startAuthentication,
} from '@simplewebauthn/browser';
import api from '@/api/client';
import { isMfaChallengeExpired } from './useMfa';
import type { PasskeyChallengeResponse } from '@/modules/auth/types';
import {
  isPasskeyDismissed,
  passkeyErrorMessage,
} from '@/modules/auth/utils/passkeyErrors';

interface MfaPasskeyCallbacks {
  onVerified: () => void;
  onExpired: () => void;
}

/**
 * Answers the pending sign-in's second step with one of the account's own
 * passkeys instead of a code. The server only offers the account's passkeys,
 * so the browser never lists those of anyone else.
 */
export function useMfaPasskey({ onVerified, onExpired }: MfaPasskeyCallbacks) {
  const supported = browserSupportsWebAuthn();
  const verifying = ref(false);
  const error = ref('');

  async function verifyWithPasskey(): Promise<void> {
    if (verifying.value) return;
    verifying.value = true;
    error.value = '';
    try {
      const { data } = await api.post<PasskeyChallengeResponse>(
        '/auth/mfa/passkey/challenge',
      );
      const credential = await startAuthentication({
        optionsJSON: data.options,
      });
      await api.post('/auth/mfa/passkey/verify', {
        challengeId: data.challengeId,
        credential,
      });
      onVerified();
    } catch (err: unknown) {
      if (isMfaChallengeExpired(err)) onExpired();
      else if (!isPasskeyDismissed(err)) {
        error.value = passkeyErrorMessage(err, 'auth.passkeys.errors.confirm');
      }
    } finally {
      verifying.value = false;
    }
  }

  function clearError(): void {
    error.value = '';
  }

  onBeforeUnmount(() => WebAuthnAbortService.cancelCeremony());

  return { supported, verifying, error, verifyWithPasskey, clearError };
}
