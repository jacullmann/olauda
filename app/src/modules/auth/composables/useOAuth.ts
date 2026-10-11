import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import api from '@/api/api.ts';
import { useToast } from '@/common/composables/useToast';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import { consumeReauthReturn } from '@/modules/auth/utils/reauthReturn';
import { useReauthModal } from '@/stores/modalStore';

const showSignUpModal = ref(false);

interface LinkedProvider {
  provider: string;
  email: string;
}

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * The reasons a Google redirect comes back with that the user can act on.
 * Any other reason is a failure on the way and gets the flow's own message.
 */
const REASON_KEYS: Partial<Record<string, string>> = {
  google_account_taken: 'auth.google.errors.account_taken',
  provider_already_linked: 'auth.google.errors.already_linked',
  google_account_mismatch: 'auth.reauth.errors.google_account_mismatch',
  session_expired: 'auth.errors.session_expired',
  registration_paused: 'auth.errors.registration_paused',
};

// The user cancelled on Google's side, which is their choice and no error.
const CANCELLED = 'access_denied';

export function useOAuth() {
  const { t } = useI18n();
  const router = useRouter();

  function showRedirectError(reason: string | null, fallbackKey: string): void {
    if (reason === CANCELLED) return;
    useToast().error(t((reason && REASON_KEYS[reason]) || fallbackKey));
  }

  // A full navigation: the API answers with a redirect to Google.
  function navigateToApi(path: string): void {
    const base =
      typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_API_URL ?? '')
        : '';
    window.location.href = `${base}${path}`;
  }

  // Signs in and signs up alike: an account with the Google email is linked
  // on the spot, and an unknown Google account comes back as
  // `signup-required` and is only created once the terms are accepted.
  function initiateGoogleLogin(): void {
    navigateToApi('/auth/google');
  }

  // The backend binds the flow to the signed-in user before Google is
  // opened, so the Google account may use a different email address.
  async function initiateGoogleLink(): Promise<ActionResult> {
    try {
      const { data } = await api.post<{ url: string }>(
        '/auth/google/link/start',
      );
      window.location.assign(data.url);
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: authErrorMessage(err, t('auth.connected_accounts.errors.link')),
      };
    }
  }

  // Every second-factor challenge, whatever the first factor was, is answered
  // on the same page.
  async function openMfaChallenge(): Promise<void> {
    await router.isReady();
    await router.replace({ name: 'verify-mfa' });
  }

  // Stripped through the router: a raw history.replaceState would be undone
  // when the pending initial navigation commits its own URL.
  async function stripOAuthParams(): Promise<void> {
    await router.isReady();
    const query = { ...router.currentRoute.value.query };
    if (!('auth' in query)) return;
    delete query.auth;
    delete query.reason;
    await router.replace({ query });
  }

  async function returnToConnectedAccounts(
    result: string,
    reason: string | null,
  ): Promise<void> {
    if (result !== 'success') {
      showRedirectError(reason, 'auth.connected_accounts.errors.link');
    }
    await router.isReady();
    await router.replace({
      name: 'account-settings',
      params: { tab: 'security', subTab: 'connected-accounts' },
    });
  }

  /**
   * Back from confirming an action with Google: on the page the user left,
   * where they repeat the action, after entering their second factor if the
   * account has one.
   */
  async function returnFromReauth(
    result: string,
    reason: string | null,
  ): Promise<void> {
    await router.isReady();
    await router.replace(consumeReauthReturn() ?? '/');

    if (result === 'error') {
      showRedirectError(reason, 'auth.reauth.errors.google');
      return;
    }

    const confirmed =
      result === 'success' ||
      (result === 'second-factor' &&
        (await useReauthModal().request('google-second-factor')));
    if (confirmed) useToast().success(t('auth.reauth.notices.confirmed'));
  }

  // The backend redirect is a full page load, so App calls this exactly once
  // with the landing URL, before the router has resolved or redirected it.
  function handleOAuthReturn(onSuccess: () => void | Promise<void>): void {
    const params = new URLSearchParams(window.location.search);

    const reauth = params.get('reauth');
    if (reauth) {
      void returnFromReauth(reauth, params.get('reason'));
      return;
    }

    const link = params.get('link');
    if (link) {
      void returnToConnectedAccounts(link, params.get('reason'));
      return;
    }

    const auth = params.get('auth');
    if (!auth) return;

    if (auth === 'mfa-pending') {
      void openMfaChallenge();
      return;
    }

    void stripOAuthParams();

    switch (auth) {
      case 'success':
        void onSuccess();
        break;

      case 'signup-required':
        showSignUpModal.value = true;
        break;

      case 'error':
        if (params.get('reason') === 'shutdown') {
          void router.replace({ name: 'maintenance' });
        } else {
          showRedirectError(params.get('reason'), 'auth.google.errors.sign_in');
        }
        break;
    }
  }

  // The account is created only here, after the user accepted the terms for
  // the Google identity the callback verified.
  async function signUpWithGoogle(): Promise<ActionResult> {
    try {
      await api.post('/auth/google/signup', { acceptedTerms: true });
      showSignUpModal.value = false;
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: authErrorMessage(err, t('auth.errors.sign_up')),
      };
    }
  }

  async function unlinkGoogleAccount(): Promise<ActionResult> {
    try {
      await api.delete('/auth/google/unlink');
      return { ok: true };
    } catch (err: unknown) {
      return {
        ok: false,
        error: authErrorMessage(
          err,
          t('auth.connected_accounts.errors.unlink'),
        ),
      };
    }
  }

  async function fetchLinkedProviders(): Promise<LinkedProvider[]> {
    try {
      const { data } = await api.get<{ providers: LinkedProvider[] }>(
        '/auth/providers',
      );
      return data.providers ?? [];
    } catch {
      return [];
    }
  }

  function closeSignUpModal(): void {
    showSignUpModal.value = false;
  }

  return {
    showSignUpModal,
    initiateGoogleLogin,
    initiateGoogleLink,
    handleOAuthReturn,
    signUpWithGoogle,
    unlinkGoogleAccount,
    fetchLinkedProviders,
    closeSignUpModal,
  };
}
