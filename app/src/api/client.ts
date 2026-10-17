import createClient from 'openapi-fetch';
import {
  ApiError,
  bannedGroupId,
  isAccessTokenRejected,
  isReauthRequired,
  isSessionRejected,
  isShutdown,
  mutedGroupId,
} from './errors';
import { requestReauth } from './reauth';
import type { paths } from './schema';

/** Where the API lives; `/api` in development, proxied by Vite. */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const REFRESH_PATH = '/auth/refresh';
// The confirmation dialog's own requests: waiting on a confirmation from
// inside it would never settle.
const REAUTH_PATH_PREFIX = '/auth/reauth';
const REFRESH_LOCK = 'auth-refresh';
const LAST_REFRESH_KEY = 'auth:last-refresh';
// Bounds how long other tabs can be stuck waiting on the refresh lock.
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * The typed API client. Requests resolve to `{ data }` or `{ error }`;
 * `unwrap` turns them into the data or a thrown `ApiError`.
 */
const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: sendWithSession,
});

export default api;

type ApiResult = { data?: unknown; error?: unknown; response: Response };

/** What a request answers with when it succeeds. */
type SuccessData<R extends ApiResult> = R extends { error?: never }
  ? R['data']
  : never;

/** The data of a successful request; any other answer throws an `ApiError`. */
export async function unwrap<R extends ApiResult>(
  pending: Promise<R>,
): Promise<SuccessData<R>> {
  const result = await pending;
  if (result.response.ok) return result.data as SuccessData<R>;
  throw new ApiError(result.response.status, result.error);
}

const csrfToken = (): string | null => {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

/** Sets the CSRF cookie the changing requests have to repeat as a header. */
export async function ensureCsrf(): Promise<void> {
  if (!csrfToken()) await unwrap(api.GET('/system/csrf/init'));
}

/** The path of a request as the API names it, without the base URL's. */
function apiPath(request: Request): string {
  const base = new URL(API_BASE_URL || '/', window.location.origin);
  const basePath = base.pathname.replace(/\/$/, '');
  return new URL(request.url).pathname.slice(basePath.length);
}

/**
 * Sends a request and recovers what the session itself can fix: an expired
 * access token is refreshed and a sensitive action confirmed, after which the
 * request is repeated once as if nothing happened. Conditions that concern
 * the whole app (shutdown, a banned group, a mute) are announced on the way.
 */
async function sendWithSession(request: Request): Promise<Response> {
  const path = apiPath(request);
  let refreshed = false;
  let reauthed = false;

  for (;;) {
    // The body can only be read once, so every attempt gets its own copy.
    const attempt = request.clone();
    const token = csrfToken();
    if (token) attempt.headers.set(CSRF_HEADER, token);

    const response = await fetch(attempt);
    if (response.ok) return response;

    const error = await ApiError.from(response.clone());
    announce(error);

    // Only once, so a confirmation that does not take cannot loop.
    if (
      !reauthed &&
      !path.startsWith(REAUTH_PATH_PREFIX) &&
      isReauthRequired(error)
    ) {
      reauthed = true;
      if (await requestReauth()) continue;
      return response;
    }

    // Only an expired or missing access token is fixed by a refresh. The
    // refresh is excluded explicitly: waiting on itself would never settle.
    if (path === REFRESH_PATH || !isAccessTokenRejected(error)) {
      return response;
    }
    if (refreshed) {
      // The access token from a successful refresh was refused as well.
      notify('auth-expired');
      return response;
    }
    refreshed = true;
    try {
      await refreshSessionOrSignOut();
    } catch {
      return response;
    }
  }
}

/** Tells the app about conditions no single caller can handle alone. */
function announce(error: ApiError): void {
  // Nothing is retried after shutdown: it lasts until a superadmin ends it.
  if (isShutdown(error)) return notify('shutdown');

  // A group banned while it is open closes at once instead of failing
  // request by request.
  const banned = bannedGroupId(error);
  if (banned) return notify('group-banned', banned);

  // A mute placed while the group is open hides what can no longer be done
  // at once; the caller still reports the failed action.
  const muted = mutedGroupId(error);
  if (muted) notify('group-muted', muted);
}

function notify(type: string, detail?: string): void {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

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
  await unwrap(
    api.POST('/auth/refresh', {
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    }),
  );
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
      if (isSessionRejected(error)) notify('auth-expired');
      throw error;
    })
    .finally(() => {
      refreshOrSignOutInFlight = null;
    });
  return refreshOrSignOutInFlight;
}
