import { isAxiosError, isCancel } from 'axios';
import i18n from '@/i18n';

/** The machine-readable `code` some API errors carry next to their message. */
export function apiErrorCode(err: unknown): string | undefined {
  if (!isAxiosError<{ code?: unknown }>(err)) return undefined;
  const code = err.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Like `apiErrorCode`, but also for requests made with `responseType: 'blob'`,
 * whose error body arrives as a Blob instead of parsed JSON.
 */
export async function readApiErrorCode(
  err: unknown,
): Promise<string | undefined> {
  if (!isAxiosError(err)) return undefined;
  const data: unknown = err.response?.data;
  if (!(data instanceof Blob)) return apiErrorCode(err);

  try {
    const body: unknown = JSON.parse(await data.text());
    const code =
      typeof body === 'object' && body !== null && 'code' in body
        ? body.code
        : undefined;
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
}

const SECONDS_PER_MINUTE = 60;

/** Whole minutes until a locked action may be tried again, at least one. */
export function retryAfterMinutes(err: unknown): number {
  const seconds = isAxiosError<{ retryAfter?: unknown }>(err)
    ? err.response?.data?.retryAfter
    : undefined;
  return typeof seconds === 'number'
    ? Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE))
    : 1;
}

export function apiErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
export const REAUTH_REQUIRED = 'REAUTH_REQUIRED';
const TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;
const SERVICE_UNAVAILABLE = 503;
const SHUTDOWN = 'SHUTDOWN';
const GROUP_BANNED = 'GROUP_BANNED';
const MUTED_IN_GROUP = 'MUTED_IN_GROUP';

/** Whether the API refused the request for being one too many. */
export function isRateLimited(err: unknown): boolean {
  return apiErrorStatus(err) === TOO_MANY_REQUESTS;
}

/**
 * Whether the API turned a request away for lacking a valid access token,
 * which a refresh can fix. Other 401s, such as a wrong password, carry no
 * `requiresAuth` and say nothing about the session.
 */
export function isAccessTokenRejected(err: unknown): boolean {
  return (
    isAxiosError<{ requiresAuth?: unknown }>(err) &&
    err.response?.status === UNAUTHORIZED &&
    err.response.data?.requiresAuth === true
  );
}

/**
 * Whether the API asks the user to confirm who they are before a sensitive
 * action. The session itself is fine, which is why this is a 403.
 */
export async function isReauthRequired(err: unknown): Promise<boolean> {
  return (
    apiErrorStatus(err) === FORBIDDEN &&
    (await readApiErrorCode(err)) === REAUTH_REQUIRED
  );
}

/**
 * Whether a request failed only because the user cancelled confirming who
 * they are. That was their choice, so it is no error worth showing. A blob
 * response has no readable body here, but its only 403 is this one.
 */
export function isReauthDeclined(err: unknown): boolean {
  if (apiErrorStatus(err) !== FORBIDDEN || !isAxiosError(err)) return false;
  return (
    err.response?.data instanceof Blob || apiErrorCode(err) === REAUTH_REQUIRED
  );
}

/** Whether the API refused a refresh, the only failure that means signed out. */
export function isSessionRejected(err: unknown): boolean {
  return apiErrorStatus(err) === UNAUTHORIZED;
}

/**
 * Whether a superadmin shut the platform down. The session is
 * kept, so the user is back in once it ends.
 */
export function isShutdown(err: unknown): boolean {
  return (
    apiErrorStatus(err) === SERVICE_UNAVAILABLE &&
    apiErrorCode(err) === SHUTDOWN
  );
}

/**
 * The group a superadmin banned, when that is why the request was refused.
 * The group is named because requests to several groups can be in flight.
 */
export function bannedGroupId(err: unknown): string | undefined {
  return refusingGroupId(err, GROUP_BANNED);
}

/** The group the user was muted in, when that is why the request was refused. */
export function mutedGroupId(err: unknown): string | undefined {
  return refusingGroupId(err, MUTED_IN_GROUP);
}

function refusingGroupId(err: unknown, code: string): string | undefined {
  if (
    apiErrorStatus(err) !== FORBIDDEN ||
    apiErrorCode(err) !== code ||
    !isAxiosError<{ groupId?: unknown }>(err)
  ) {
    return undefined;
  }
  const groupId = err.response?.data?.groupId;
  return typeof groupId === 'string' ? groupId : undefined;
}

/**
 * Whether the request failed for a reason that passes on its own: no answer at
 * all (offline, or the API restarting during a deploy), a server error or a
 * rate limit. Such a failure says nothing about the session. Shutdown is
 * none of these: it lasts until a superadmin ends it, so retrying is futile.
 */
export function isTransientFailure(err: unknown): boolean {
  if (!isAxiosError(err) || isCancel(err) || isShutdown(err)) return false;
  const status = err.response?.status;
  return (
    status === undefined ||
    status === TOO_MANY_REQUESTS ||
    status >= FIRST_SERVER_ERROR
  );
}

/**
 * The message for a failed request in the user's language: the shared one
 * for a rate limit or a mute, which any action can meet, else the fallback
 * naming what failed. The API's own `error` text is English and meant for
 * developers, so it is never shown; a reason worth telling apart comes as a
 * `code` its caller maps.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isRateLimited(err)) return i18n.global.t('common.errors.rate_limited');
  if (mutedGroupId(err)) return i18n.global.t('groups.errors.muted');
  return fallback;
}
