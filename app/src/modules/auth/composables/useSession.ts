import { computed, ref } from 'vue';
import { hashKey, useQuery } from '@tanstack/vue-query';
import api, { ensureCsrf, unwrap } from '@/api/client';
import { isTransientFailure } from '@/api/errors';
import { appScope, queryClient } from '@/api/queryClient';
import type { GroupStatusDto } from '@/api/schema';
import { accountKeys } from '@/modules/account/utils/accountQueries';
import {
  sessionKey,
  sessionStatusQuery,
} from '@/modules/auth/utils/sessionQueries';
import { clearGroups } from '@/modules/groups/composables/useGroups';

// Startup retries an unreachable API with backoff for about as long as a
// deploy restarts it, then reports it unreachable instead of waiting forever.
const INIT_RETRY_FIRST_DELAY_MS = 500;
const INIT_RETRY_MAX_DELAY_MS = 8_000;
const INIT_RETRY_DEADLINE_MS = 30_000;

const SIGNED_OUT: GroupStatusDto = {
  authenticated: false,
  groups: [],
  landingGroupId: null,
};

const isAuthReady = ref(false);
/** Startup gave up on an API that never answered; the session is unknown. */
const isApiUnreachable = ref(false);

// Observed once startup resolved the session, so focus and live updates keep
// the groups current from then on. A signed-out visitor is not asked again
// on every focus: each ask would try a refresh the server refuses.
const status = appScope.run(() =>
  useQuery(
    {
      ...sessionStatusQuery(),
      enabled: isAuthReady,
      refetchOnWindowFocus: ({ state }) => state.data?.authenticated === true,
    },
    queryClient,
  ),
)!;

/** The session as last loaded; `undefined` before startup resolved it. */
export const sessionStatus = computed(() => status.data.value);

const isLoggedIn = computed(() => sessionStatus.value?.authenticated === true);

let initPromise: Promise<void> | null = null;
let signedOutHandlersInstalled = false;

/**
 * Forgets everything loaded for the previous user, so nothing of theirs is
 * shown to whoever signs in next. The session and the profile are observed
 * app-wide, so they are emptied in place rather than removed.
 */
function clearSession(): void {
  // Cancelling reverts at once, so no answer still on its way for the
  // previous user can land in the cache after it was cleared.
  void queryClient.cancelQueries();
  const observedAppWide = [hashKey(sessionKey), hashKey(accountKeys.me())];
  queryClient.removeQueries({
    predicate: ({ queryHash }) => !observedAppWide.includes(queryHash),
  });
  queryClient.setQueryData(sessionKey, SIGNED_OUT);
  queryClient.setQueryData(accountKeys.me(), null);
  // Whoever signs in next gets their own profile as soon as it is observed.
  void queryClient.invalidateQueries({
    queryKey: accountKeys.me(),
    refetchType: 'none',
  });
  clearGroups();
}

function showSignedOut(): void {
  clearSession();
  isAuthReady.value = true;
  initPromise = null;
}

// Shutdown keeps the session on the server, but nothing in the app can be
// used until it ends, so the app shows the signed-out state meanwhile.
function installSignedOutHandlersOnce(): void {
  if (signedOutHandlersInstalled) return;
  signedOutHandlersInstalled = true;
  window.addEventListener('auth-expired', showSignedOut);
  window.addEventListener('shutdown', showSignedOut);
}

async function resolveSession(): Promise<void> {
  await ensureCsrf();
  await queryClient.fetchQuery(sessionStatusQuery());
}

// An unreachable API (offline, or restarting during a deploy) says nothing
// about the session, so it is asked again instead of showing a signed-in user
// the login page.
async function resolveSessionWhenReachable(): Promise<void> {
  const deadline = Date.now() + INIT_RETRY_DEADLINE_MS;
  for (
    let delay = INIT_RETRY_FIRST_DELAY_MS;
    ;
    delay = Math.min(delay * 2, INIT_RETRY_MAX_DELAY_MS)
  ) {
    try {
      return await resolveSession();
    } catch (error) {
      if (!isTransientFailure(error) || Date.now() + delay > deadline) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// The app must not render until the session is resolved: an expired access
// token with a valid refresh cookie is still a logged-in user, and anything
// mounted in between would act on a false "logged out" state.
async function doInitAuth(): Promise<void> {
  try {
    await resolveSessionWhenReachable();
  } catch (error) {
    clearSession();
    isApiUnreachable.value = isTransientFailure(error);
  } finally {
    isAuthReady.value = true;
    initPromise = null;
  }
}

export function useSession() {
  installSignedOutHandlersOnce();

  /** Loads the session again, e.g. after signing in or joining a group. */
  async function checkAuthStatus(): Promise<boolean> {
    try {
      const fresh = await queryClient.fetchQuery({
        ...sessionStatusQuery(),
        staleTime: 0,
      });
      return fresh.authenticated;
    } catch {
      // The status never rejects a session, so a failed check changes nothing.
      return isLoggedIn.value;
    }
  }

  async function initAuth(): Promise<void> {
    if (isAuthReady.value) return;
    initPromise ??= doInitAuth();
    return initPromise;
  }

  async function endSession(path: '/auth/logout' | '/auth/logout-all') {
    try {
      await unwrap(api.POST(path));
    } catch {
      // Local state is cleared regardless of what the server replies.
    } finally {
      clearSession();
    }
  }

  return {
    isLoggedIn,
    isAuthReady,
    isApiUnreachable,
    initAuth,
    checkAuthStatus,
    logout: () => endSession('/auth/logout'),
    logoutAllDevices: () => endSession('/auth/logout-all'),
  };
}
