import { computed, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage, isReauthDeclined } from '@/api/errors';
import type { MfaSetupDto } from '@/api/schema';
import i18n from '@/i18n';
import {
  accountKeys,
  mfaStatusQuery,
} from '@/modules/account/utils/accountQueries';
import { mfaFailure, type MfaResult } from './useMfa';

/** Turning two-factor authentication on and off in the account settings. */
export function useMfaSettings() {
  const queryClient = useQueryClient();
  const status = useQuery(mfaStatusQuery());
  const mfaError = ref<string | null>(null);

  // Every change ends the other sessions and shows in the profile, so the
  // whole account is read again.
  const changed = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.all });

  const activate = useMutation({
    mutationFn: (code: string) =>
      unwrap(api.POST('/mfa/activate', { body: { code } })),
    onSettled: changed,
  });
  const deactivate = useMutation({
    mutationFn: () => unwrap(api.POST('/mfa/deactivate')),
    onSettled: changed,
  });
  const regenerate = useMutation({
    mutationFn: () => unwrap(api.POST('/mfa/recovery-codes')),
    onSettled: changed,
  });

  async function run<T>(
    action: () => Promise<T>,
    fallbackKey: string,
  ): Promise<MfaResult<{ data: T }>> {
    mfaError.value = null;
    try {
      return { ok: true, data: await action() };
    } catch (err: unknown) {
      const result = mfaFailure(err, fallbackKey);
      if (!result.ok && result.error) mfaError.value = result.error;
      return result;
    }
  }

  /** `null` when it failed or the user declined to confirm who they are. */
  async function startMfaSetup(): Promise<MfaSetupDto | null> {
    mfaError.value = null;
    try {
      return await unwrap(api.POST('/mfa/setup'));
    } catch (err: unknown) {
      if (!isReauthDeclined(err)) {
        mfaError.value = apiErrorMessage(
          err,
          i18n.global.t('auth.mfa.errors.start_setup'),
        );
      }
      return null;
    }
  }

  return {
    mfaEnabled: computed(() => status.data.value?.mfaEnabled ?? false),
    recoveryCodesLeft: computed(
      () => status.data.value?.recoveryCodesLeft ?? null,
    ),
    mfaError,
    startMfaSetup,
    /** Resolves with the recovery codes, which are shown only this once. */
    activateMfa: (code: string) =>
      run(
        async () => (await activate.mutateAsync(code)).recoveryCodes,
        'auth.mfa.errors.turn_on',
      ),
    deactivateMfa: () =>
      run(() => deactivate.mutateAsync(), 'auth.mfa.errors.turn_off'),
    regenerateRecoveryCodes: () =>
      run(
        async () => (await regenerate.mutateAsync()).recoveryCodes,
        'auth.mfa.errors.regenerate_codes',
      ),
  };
}
