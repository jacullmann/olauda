import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  browserSupportsWebAuthn,
  sendSignal,
  startRegistration,
} from '@simplewebauthn/browser';
import api, { unwrap } from '@/api/client';
import type { PasskeyList, PasskeySummary } from '@/api/schema';
import {
  accountKeys,
  passkeysQuery,
} from '@/modules/account/utils/accountQueries';
import {
  isPasskeyDismissed,
  passkeyErrorMessage,
} from '@/modules/auth/utils/passkeyErrors';
import { creationOptions } from '@/modules/auth/utils/passkeyOptions';
import { parseUserAgent } from '@/common/utils/userAgent';
import { useToast } from '@/common/composables/useToast';

export type PasskeyActionResult =
  | { ok: true }
  | { ok: false; dismissed: true }
  | { ok: false; dismissed: false; error: string };

/**
 * Tells the passkey manager which passkeys the account still accepts, so it
 * can hide those removed here, including ones removed on another device.
 */
function signalAcceptedPasskeys(list: PasskeyList): void {
  sendSignal({
    signalName: 'allAcceptedCredentials',
    rpID: list.rpId,
    userID: list.userHandle,
    allAcceptedCredentialIDs: list.passkeys.map((p) => p.credentialId),
  }).catch(() => {
    // Best effort: most browsers do not support the signal API yet.
  });
}

/** Manages the signed-in user's passkeys in the account settings. */
export function usePasskeys() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const supported = browserSupportsWebAuthn();
  const list = useQuery(passkeysQuery());
  const passkeys = computed(() => list.data.value?.passkeys ?? []);

  watch(list.data, (current) => current && signalAcceptedPasskeys(current));
  watch(list.error, (error) => {
    if (error)
      toast.error(passkeyErrorMessage(error, 'auth.passkeys.errors.load'));
  });

  const changed = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.all });

  function defaultPasskeyName(): string {
    const { browser, os } = parseUserAgent(navigator.userAgent);
    if (browser && os) return t('auth.sessions.device_label', { browser, os });
    return os ?? browser ?? t('auth.passkeys.default_name');
  }

  const add = useMutation({
    mutationFn: async () => {
      const registration = await unwrap(
        api.POST('/passkeys/registration/start'),
      );
      const credential = await startRegistration({
        optionsJSON: creationOptions(registration),
      });
      return unwrap(
        api.POST('/passkeys/registration/finish', {
          body: { name: defaultPasskeyName(), credential },
        }),
      );
    },
    onSettled: changed,
  });

  const rename = useMutation({
    mutationFn: ({
      passkey,
      name,
    }: {
      passkey: PasskeySummary;
      name: string;
    }) =>
      unwrap(
        api.PATCH('/passkeys/{id}', {
          params: { path: { id: passkey.id } },
          body: { name },
        }),
      ),
    onSettled: changed,
  });

  const remove = useMutation({
    mutationFn: (passkey: PasskeySummary) =>
      unwrap(
        api.DELETE('/passkeys/{id}', { params: { path: { id: passkey.id } } }),
      ),
    onSettled: changed,
  });

  async function settle(
    action: Promise<unknown>,
    fallbackKey: string,
  ): Promise<PasskeyActionResult> {
    try {
      await action;
      return { ok: true };
    } catch (err: unknown) {
      if (isPasskeyDismissed(err)) return { ok: false, dismissed: true };
      return {
        ok: false,
        dismissed: false,
        error: passkeyErrorMessage(err, fallbackKey),
      };
    }
  }

  return {
    supported,
    passkeys,
    loading: list.isPending,
    loadFailed: list.isError,
    fetchPasskeys: () => list.refetch(),
    addPasskey: () => settle(add.mutateAsync(), 'auth.passkeys.errors.add'),
    renamePasskey: (passkey: PasskeySummary, name: string) =>
      settle(
        rename.mutateAsync({ passkey, name }),
        'auth.passkeys.errors.rename',
      ),
    removePasskey: (passkey: PasskeySummary) =>
      settle(remove.mutateAsync(passkey), 'auth.passkeys.errors.remove'),
  };
}
