import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import type { SignInMethods } from '@/modules/auth/types';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import { useUserStore } from '@/stores/userStore';

type ActionResult = { ok: true } | { ok: false; error: string };

/** The ways the account signs in, and removing its password. */
export function useSignInMethods() {
  const { t } = useI18n();
  const userStore = useUserStore();

  const methods = ref<SignInMethods | null>(null);
  const removing = ref(false);

  /** The password can go once a passkey or Google signs the user in. */
  const canRemovePassword = computed(
    () =>
      !!methods.value?.password &&
      (methods.value.passkeys > 0 || methods.value.google),
  );

  async function fetchMethods(): Promise<void> {
    try {
      const { data } = await api.get<SignInMethods>('/auth/sign-in-methods');
      methods.value = data;
    } catch {
      // Without the methods the removal is simply not offered.
      methods.value = null;
    }
  }

  async function removePassword(): Promise<ActionResult> {
    removing.value = true;
    try {
      await api.delete('/auth/password');
      if (methods.value) methods.value = { ...methods.value, password: false };
      userStore.updateUser({ hasPassword: false });
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: authErrorMessage(err, t('auth.remove_password.errors.remove')),
      };
    } finally {
      removing.value = false;
    }
  }

  return { methods, removing, canRemovePassword, fetchMethods, removePassword };
}
