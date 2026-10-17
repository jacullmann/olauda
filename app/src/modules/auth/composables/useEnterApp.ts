import { useRouter } from 'vue-router';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useSession } from './useSession';
import { consumeLoginReturn } from '@/modules/auth/utils/loginReturn';

/**
 * Loads the account that just signed in and opens the page it asked for
 * before signing in, else its home page.
 */
export function useEnterApp() {
  const router = useRouter();
  const userStore = useUserStore();
  const { checkAuthStatus } = useSession();
  const { homeRoute } = useGroups();

  return async function enterApp() {
    await checkAuthStatus();
    await userStore.fetchUser();
    await router.push(consumeLoginReturn() ?? homeRoute.value);
  };
}
