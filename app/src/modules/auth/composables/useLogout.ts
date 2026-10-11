import { useRouter } from 'vue-router';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useSession } from './useSession';
import { useMfa } from './useMfa';
import { clearLoginReturn } from '@/modules/auth/utils/loginReturn';

/**
 * Ends the session and shows the login page. `useSession().logout()` is what
 * calls `/auth/logout`; local state is cleared even if that request fails.
 *
 * The login route is targeted directly: `/` redirects to `/groups`, which is a
 * no-op navigation when the user is already there, so the auth guard never runs.
 */
export function useLogout(): () => Promise<void> {
  const router = useRouter();
  const userStore = useUserStore();
  const { logout: endSession } = useSession();
  const { resetMfaState } = useMfa();

  return async () => {
    userStore.clearUser();
    resetMfaState();
    clearLoginReturn();
    await endSession();
    await router.push({ name: 'login' });
  };
}
