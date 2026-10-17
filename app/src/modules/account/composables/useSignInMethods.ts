import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import {
  accountKeys,
  signInMethodsQuery,
} from '@/modules/account/utils/accountQueries';

type ActionResult = { ok: true } | { ok: false; error: string };

/** The ways the account signs in, and removing its password. */
export function useSignInMethods() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // Without the methods the removal is simply not offered.
  const { data: methods } = useQuery(signInMethodsQuery());

  /** The password can go once a passkey or Google signs the user in. */
  const canRemovePassword = computed(
    () =>
      !!methods.value?.password &&
      (methods.value.passkeys > 0 || methods.value.google),
  );

  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/auth/password')),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });

  async function removePassword(): Promise<ActionResult> {
    try {
      await remove.mutateAsync();
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: authErrorMessage(err, t('auth.remove_password.errors.remove')),
      };
    }
  }

  return {
    methods,
    removing: remove.isPending,
    canRemovePassword,
    removePassword,
  };
}
