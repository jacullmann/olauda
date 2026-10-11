import { ref } from 'vue';
import api, { ensureCsrf, refreshSession } from '@/api/client';
import { isSessionRejected, isTransientFailure } from '@/api/errors';
import {
  applyGroupStatus,
  clearGroups,
  type RawGroup,
} from '@/modules/groups/composables/useGroups';

const STATUS_ENDPOINT = '/groups/status';
// Startup retries an unreachable API with backoff for about as long as a
// deploy restarts it, then reports it unreachable instead of waiting forever.
const INIT_RETRY_FIRST_DELAY_MS = 500;
const INIT_RETRY_MAX_DELAY_MS = 8_000;
const INIT_RETRY_DEADLINE_MS = 30_000;

type StatusResponse = {
  authenticated: boolean;
  groups?: RawGroup[];
  landingGroupId?: string | null;
};

const isLoggedIn = ref(false);
const isAuthReady = ref(false);
/** Startup gave up on an API that never answered; the session is unknown. */
const isApiUnreachable = ref(false);

let initPromise: Promise<void> | null = null;
let statusPromise: Promise<boolean> | null = null;
let signedOutHandlersInstalled = false;

function clearSession(): void {
  isLoggedIn.value = false;
  clearGroups();
  statusPromise = null;
}

function applyStatusData(data: StatusResponse): void {
  isLoggedIn.value = data.authenticated;
  applyGroupStatus(data.groups ?? [], data.landingGroupId ?? null);
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

async function fetchStatus(): Promise<StatusResponse> {
  const { data } = await api.get<StatusResponse>(STATUS_ENDPOINT);
  return data;
}

/** Whether the refresh cookie still holds a session the server renewed. */
async function renewSession(): Promise<boolean> {
  try {
    await refreshSession();
    return true;
  } catch (error) {
    if (isSessionRejected(error)) return false;
    throw error;
  }
}

/**
 * The status only sees the access token, which lapses long before the
 * session does: "not authenticated" is final only once a refresh failed too,
 * so it is not applied before then.
 */
async function loadSession(): Promise<boolean> {
  let status = await fetchStatus();
  if (!status.authenticated && (await renewSession())) {
    status = await fetchStatus();
  }
  applyStatusData(status);
  return status.authenticated;
}

async function resolveSession(): Promise<void> {
  await ensureCsrf();
  await loadSession();
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

  async function checkAuthStatus(): Promise<boolean> {
    if (statusPromise) return statusPromise;

    statusPromise = (async () => {
      try {
        return await loadSession();
      } catch {
        // The status never rejects a session, so a failed check changes nothing.
        return isLoggedIn.value;
      } finally {
        statusPromise = null;
      }
    })();

    return statusPromise;
  }

  async function initAuth(): Promise<void> {
    if (isAuthReady.value) return;
    if (initPromise) return initPromise;
    initPromise = doInitAuth();
    return initPromise;
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local state is cleared regardless of what the server replies.
    } finally {
      clearSession();
    }
  }

  async function logoutAllDevices(): Promise<void> {
    try {
      await api.post('/auth/logout-all');
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
    logout,
    logoutAllDevices,
  };
}
