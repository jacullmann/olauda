import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  sendSignal,
  startAuthentication,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/browser';
import api, { unwrap } from '@/api/client';
import { ApiError, apiErrorCode } from '@/api/errors';
import type { PasskeyChallengeDto } from '@/api/schema';
import { useToast } from '@/common/composables/useToast';
import {
  isPasskeyDismissed,
  passkeyErrorMessage,
} from '@/modules/auth/utils/passkeyErrors';
import { requestOptions } from '@/modules/auth/utils/passkeyOptions';

/** Replaces the autofill challenge this long before the server lets it expire. */
const AUTOFILL_RENEW_MARGIN_MS = 30_000;
const FALLBACK_CHALLENGE_TIMEOUT_MS = 300_000;

/**
 * Usernameless sign-in with a passkey, either from a button or offered by the
 * browser in the autofill list of the email field.
 */
export function usePasskeySignIn(onSignedIn: () => void | Promise<void>) {
  const supported = browserSupportsWebAuthn();
  const signingIn = ref(false);
  const toast = useToast();

  let active = true;
  let renewTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRenewTimer(): void {
    if (renewTimer !== null) {
      clearTimeout(renewTimer);
      renewTimer = null;
    }
  }

  const requestChallenge = (): Promise<PasskeyChallengeDto> =>
    unwrap(api.POST('/auth/passkey/challenge'));

  async function verify(
    challenge: PasskeyChallengeDto,
    credential: AuthenticationResponseJSON,
  ): Promise<void> {
    signingIn.value = true;
    try {
      await unwrap(
        api.POST('/auth/passkey/verify', {
          body: { challengeId: challenge.challengeId, credential },
        }),
      );
    } catch (err: unknown) {
      const { rpId } = requestOptions(challenge);
      if (apiErrorCode(err) === 'PASSKEY_UNKNOWN' && rpId) {
        // The passkey was removed from its account; let the passkey manager
        // stop offering it.
        sendSignal({
          signalName: 'unknownCredential',
          rpID: rpId,
          credentialID: credential.id,
        }).catch(() => {
          // Best effort: most browsers do not support the signal API yet.
        });
      }
      throw err;
    } finally {
      signingIn.value = false;
    }
    await onSignedIn();
  }

  function reportFailure(err: unknown): void {
    if (!active || isPasskeyDismissed(err)) return;
    toast.error(passkeyErrorMessage(err, 'auth.passkeys.errors.sign_in'));
  }

  /**
   * Keeps a conditional request open, so the browser can offer passkeys in
   * the autofill list of any input whose autocomplete ends in `webauthn`. The
   * server only honours a challenge for a few minutes, so a fresh one replaces
   * it shortly before then.
   */
  async function offerPasskeyAutofill(): Promise<void> {
    clearRenewTimer();
    if (!active || !(await browserSupportsWebAuthnAutofill())) return;

    let challenge: PasskeyChallengeDto;
    try {
      challenge = await requestChallenge();
    } catch {
      return;
    }
    if (!active) return;

    const optionsJSON = requestOptions(challenge);
    const timeout = optionsJSON.timeout ?? FALLBACK_CHALLENGE_TIMEOUT_MS;
    renewTimer = setTimeout(
      () => void offerPasskeyAutofill(),
      Math.max(timeout - AUTOFILL_RENEW_MARGIN_MS, AUTOFILL_RENEW_MARGIN_MS),
    );

    try {
      const credential = await startAuthentication({
        optionsJSON,
        useBrowserAutofill: true,
      });
      clearRenewTimer();
      await verify(challenge, credential);
    } catch (err: unknown) {
      // A newer request (renewal or the button) aborts this one and takes over.
      if (isPasskeyDismissed(err)) return;
      reportFailure(err);
      // Only a refusal by the server is worth another round; a browser that
      // failed the ceremony itself would just fail again.
      if (err instanceof ApiError) void offerPasskeyAutofill();
    }
  }

  async function signInWithPasskey(): Promise<void> {
    if (signingIn.value) return;
    clearRenewTimer();
    signingIn.value = true;

    try {
      const challenge = await requestChallenge();
      // Starting this ceremony aborts the pending autofill request.
      const credential = await startAuthentication({
        optionsJSON: requestOptions(challenge),
      });
      await verify(challenge, credential);
    } catch (err: unknown) {
      reportFailure(err);
      void offerPasskeyAutofill();
    } finally {
      signingIn.value = false;
    }
  }

  onMounted(() => {
    if (supported) void offerPasskeyAutofill();
  });

  onBeforeUnmount(() => {
    active = false;
    clearRenewTimer();
    WebAuthnAbortService.cancelCeremony();
  });

  return { supported, signingIn, signInWithPasskey };
}
