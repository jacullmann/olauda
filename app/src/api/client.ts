import axios, { AxiosError } from 'axios';
import {
  isAccessTokenRejected,
  isShutdown,
  isReauthRequired,
  isSessionRejected,
} from './errors';
import { requestReauth } from './reauth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
});

const getCsrfFromCookie = (): string | null => {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

api.interceptors.request.use((config) => {
  const token = getCsrfFromCookie();
  if (token) config.headers['x-csrf-token'] = token;
  return config;
});

const REFRESH_URL = '/auth/refresh';
// The confirmation dialog's own requests: waiting on a confirmation from
// inside it would never settle.
const REAUTH_URL_PREFIX = '/auth/reauth';
const REFRESH_LOCK = 'auth-refresh';
const LAST_REFRESH_KEY = 'auth:last-refresh';
// Bounds how long other tabs can be stuck waiting on the refresh lock.
const REFRESH_TIMEOUT_MS = 15_000;

let refreshInFlight: Promise<void> | null = null;
let refreshOrSignOutInFlight: Promise<void> | null = null;

const readLastRefresh = (): number => {
  try {
    return Number(localStorage.getItem(LAST_REFRESH_KEY)) || 0;
  } catch {
    return 0;
  }
};

const recordRefresh = (): void => {
  try {
    localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
  } catch {
    // Without storage, a waiting tab just refreshes again, which stays valid.
  }
};

// A record from the future only exists if the clock was set back since; it
// must not stand in for a refresh that never happened.
const refreshedSince = (time: number): boolean => {
  const lastRefresh = readLastRefresh();
  return lastRefresh >= time && lastRefresh <= Date.now();
};

const postRefresh = async (): Promise<void> => {
  await api.post(REFRESH_URL, null, { timeout: REFRESH_TIMEOUT_MS });
  recordRefresh();
};

// Refresh tokens rotate on every use and share one cookie across tabs, so
// refreshes are serialized browser-wide. A tab that waited on another tab's
// refresh reuses the cookies it set instead of rotating them again.
async function refreshAcrossTabs(): Promise<void> {
  if (!navigator.locks) return postRefresh();

  const requestedAt = Date.now();
  await navigator.locks.request(REFRESH_LOCK, async () => {
    if (refreshedSince(requestedAt)) return;
    await postRefresh();
  });
}

function performRefresh(): Promise<void> {
  refreshInFlight ??= refreshAcrossTabs().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function notifySessionEnded(): void {
  window.dispatchEvent(new CustomEvent('auth-expired'));
}

function notifyShutdown(): void {
  window.dispatchEvent(new CustomEvent('shutdown'));
}

/**
 * Rotates the session's tokens. A failure has no side effects, so callers
 * that resolve the session themselves (e.g. at startup) decide what it means.
 */
export const refreshSession = (): Promise<void> => performRefresh();

/**
 * Rotates the session's tokens and signs the user out app-wide when the
 * server refuses. Callers awaiting the same refresh share one sign-out. Any
 * other failure (offline, a deploy restarting the API) leaves the refresh
 * cookie valid, so it only fails the call.
 */
export function refreshSessionOrSignOut(): Promise<void> {
  refreshOrSignOutInFlight ??= performRefresh()
    .catch((error: unknown) => {
      if (isSessionRejected(error)) notifySessionEnded();
      throw error;
    })
    .finally(() => {
      refreshOrSignOutInFlight = null;
    });
  return refreshOrSignOutInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config;

    // Any request, the refresh included, can be the first to meet shutdown.
    // Nothing is retried: it lasts until a superadmin ends it.
    if (isShutdown(error)) {
      notifyShutdown();
      return Promise.reject(error);
    }

    // A sensitive action needs a recent sign-in: once the user confirmed who
    // they are, the request is repeated as if nothing happened. Only once, so
    // a confirmation that does not take cannot loop.
    if (
      original &&
      !original._reauthed &&
      !original.url?.startsWith(REAUTH_URL_PREFIX) &&
      (await isReauthRequired(error))
    ) {
      original._reauthed = true;
      if (await requestReauth()) return api(original);
      return Promise.reject(error);
    }

    // Only an expired or missing access token is fixed by a refresh. The
    // refresh is excluded explicitly: waiting on itself would never settle.
    if (
      !original ||
      original.url === REFRESH_URL ||
      !isAccessTokenRejected(error)
    ) {
      return Promise.reject(error);
    }

    if (original._retried) {
      // The access token from a successful refresh was refused as well.
      notifySessionEnded();
      return Promise.reject(error);
    }
    original._retried = true;

    try {
      await refreshSessionOrSignOut();
    } catch {
      return Promise.reject(error);
    }

    return api(original);
  },
);

export const ensureCsrf = async (): Promise<void> => {
  if (!getCsrfFromCookie()) {
    await api.get('/system/csrf/init');
  }
};

export default api;

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retried?: boolean;
    _reauthed?: boolean;
  }
}
