import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  browserSupportsWebAuthn,
  sendSignal,
  startRegistration,
} from '@simplewebauthn/browser';
import api from '@/api/client';
import type {
  Passkey,
  PasskeyListResponse,
  PasskeyRegistrationResponse,
} from '@/modules/auth/types';
import {
  isPasskeyDismissed,
  passkeyErrorMessage,
} from '@/modules/auth/utils/passkeyErrors';
import { parseUserAgent } from '@/common/utils/userAgent';
import { useToast } from '@/common/composables/useToast';

export type PasskeyActionResult =
  | { ok: true }
  | { ok: false; dismissed: true }
  | { ok: false; dismissed: false; error: string };

/** Manages the signed-in user's passkeys in the account settings. */
export function usePasskeys() {
  const { t } = useI18n();
  const toast = useToast();

  const supported = browserSupportsWebAuthn();
  const passkeys = ref<Passkey[]>([]);
  const loading = ref(false);
  const loadFailed = ref(false);

  let account: Pick<PasskeyListResponse, 'rpId' | 'userHandle'> | null = null;

  /**
   * Tells the passkey manager which passkeys the account still accepts, so it
   * can hide those removed here, including ones removed on another device.
   */
  function signalAcceptedPasskeys(): void {
    if (!account) return;
    sendSignal({
      signalName: 'allAcceptedCredentials',
      rpID: account.rpId,
      userID: account.userHandle,
      allAcceptedCredentialIDs: passkeys.value.map((p) => p.credentialId),
    }).catch(() => {
      // Best effort: most browsers do not support the signal API yet.
    });
  }

  async function fetchPasskeys(): Promise<void> {
    loading.value = true;
    loadFailed.value = false;
    try {
      const { data } = await api.get<PasskeyListResponse>('/passkeys');
      passkeys.value = data.passkeys;
      account = { rpId: data.rpId, userHandle: data.userHandle };
      signalAcceptedPasskeys();
    } catch (err: unknown) {
      loadFailed.value = true;
      toast.error(passkeyErrorMessage(err, 'auth.passkeys.errors.load'));
    } finally {
      loading.value = false;
    }
  }

  function defaultPasskeyName(): string {
    const { browser, os } = parseUserAgent(navigator.userAgent);
    if (browser && os) return t('auth.sessions.device_label', { browser, os });
    return os ?? browser ?? t('auth.passkeys.default_name');
  }

  async function addPasskey(): Promise<PasskeyActionResult> {
    try {
      const { data } = await api.post<PasskeyRegistrationResponse>(
        '/passkeys/registration/start',
      );
      const credential = await startRegistration({ optionsJSON: data.options });
      const { data: created } = await api.post<Passkey>(
        '/passkeys/registration/finish',
        { name: defaultPasskeyName(), credential },
      );
      passkeys.value = [...passkeys.value, created];
      return { ok: true };
    } catch (err: unknown) {
      if (isPasskeyDismissed(err)) return { ok: false, dismissed: true };
      return {
        ok: false,
        dismissed: false,
        error: passkeyErrorMessage(err, 'auth.passkeys.errors.add'),
      };
    }
  }

  async function renamePasskey(
    passkey: Passkey,
    name: string,
  ): Promise<PasskeyActionResult> {
    try {
      await api.patch(`/passkeys/${passkey.id}`, { name });
      passkeys.value = passkeys.value.map((p) =>
        p.id === passkey.id ? { ...p, name: name.trim() } : p,
      );
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        dismissed: false,
        error: passkeyErrorMessage(err, 'auth.passkeys.errors.rename'),
      };
    }
  }

  async function removePasskey(passkey: Passkey): Promise<PasskeyActionResult> {
    try {
      await api.delete(`/passkeys/${passkey.id}`);
      passkeys.value = passkeys.value.filter((p) => p.id !== passkey.id);
      signalAcceptedPasskeys();
      return { ok: true };
    } catch (err: unknown) {
      if (isPasskeyDismissed(err)) return { ok: false, dismissed: true };
      return {
        ok: false,
        dismissed: false,
        error: passkeyErrorMessage(err, 'auth.passkeys.errors.remove'),
      };
    }
  }

  return {
    supported,
    passkeys,
    loading,
    loadFailed,
    fetchPasskeys,
    addPasskey,
    renamePasskey,
    removePasskey,
  };
}
