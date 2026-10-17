import i18n from '@/i18n';
import type { ErrorBody, ErrorCode } from './schema';

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;
const SERVICE_UNAVAILABLE = 503;
const SECONDS_PER_MINUTE = 60;

/**
 * A request the API answered with an error. The body's `error` text is
 * English and meant for debugging; reasons worth telling apart come as a
 * `code`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorBody | undefined;

  /** `body` is whatever the response carried, checked before it is kept. */
  constructor(status: number, body: unknown) {
    const errorBody = isErrorBody(body) ? body : undefined;
    super(errorBody?.error ?? `The API answered with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.body = errorBody;
  }

  get code(): ErrorCode | undefined {
    return this.body?.code ?? undefined;
  }

  /** Reads the error from a response, which is consumed. */
  static async from(response: Response): Promise<ApiError> {
    // Proxies and timeouts answer without the API's JSON.
    const body: unknown = await response.json().catch(() => undefined);
    return new ApiError(response.status, body);
  }
}

function isErrorBody(body: unknown): body is ErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  );
}

export function apiErrorCode(err: unknown): ErrorCode | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

export function apiErrorStatus(err: unknown): number | undefined {
  return err instanceof ApiError ? err.status : undefined;
}

/** Whole minutes until a locked action may be tried again, at least one. */
export function retryAfterMinutes(err: unknown): number {
  const seconds = err instanceof ApiError ? err.body?.retryAfter : undefined;
  return typeof seconds === 'number'
    ? Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE))
    : 1;
}

/** Whether the API refused the request for being one too many. */
export function isRateLimited(err: unknown): boolean {
  return apiErrorStatus(err) === TOO_MANY_REQUESTS;
}

/**
 * Whether the API turned a request away for lacking a valid access token,
 * which a refresh can fix. Other 401s, such as a wrong password, say nothing
 * about the session.
 */
export function isAccessTokenRejected(err: unknown): boolean {
  return (
    apiErrorStatus(err) === UNAUTHORIZED &&
    apiErrorCode(err) === 'AUTH_REQUIRED'
  );
}

/**
 * Whether the API asks the user to confirm who they are before a sensitive
 * action. The session itself is fine, which is why this is a 403.
 */
export function isReauthRequired(err: unknown): boolean {
  return (
    apiErrorStatus(err) === FORBIDDEN && apiErrorCode(err) === 'REAUTH_REQUIRED'
  );
}

/**
 * Whether a request failed only because the user cancelled confirming who
 * they are. That was their choice, so it is no error worth showing.
 */
export const isReauthDeclined = isReauthRequired;

/** Whether the API refused a refresh, the only failure that means signed out. */
export function isSessionRejected(err: unknown): boolean {
  return apiErrorStatus(err) === UNAUTHORIZED;
}

/**
 * Whether a superadmin shut the platform down. The session is kept, so the
 * user is back in once it ends.
 */
export function isShutdown(err: unknown): boolean {
  return (
    apiErrorStatus(err) === SERVICE_UNAVAILABLE &&
    apiErrorCode(err) === 'SHUTDOWN'
  );
}

/**
 * The group a superadmin banned, when that is why the request was refused.
 * The group is named because requests to several groups can be in flight.
 */
export function bannedGroupId(err: unknown): string | undefined {
  return refusingGroupId(err, 'GROUP_BANNED');
}

/** The group the user was muted in, when that is why the request was refused. */
export function mutedGroupId(err: unknown): string | undefined {
  return refusingGroupId(err, 'MUTED_IN_GROUP');
}

function refusingGroupId(err: unknown, code: ErrorCode): string | undefined {
  if (apiErrorStatus(err) !== FORBIDDEN || apiErrorCode(err) !== code) {
    return undefined;
  }
  return err instanceof ApiError ? (err.body?.groupId ?? undefined) : undefined;
}

/** Whether the request was aborted, by a newer one or by leaving the page. */
export function isAborted(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Whether the request failed for a reason that passes on its own: no answer at
 * all (offline, or the API restarting during a deploy), an unexpected server
 * error or a rate limit. Such a failure says nothing about the session. A
 * server error the API names with a code is none of these: shutdown or a
 * misconfigured external service lasts until someone acts, so retrying is
 * futile.
 */
export function isTransientFailure(err: unknown): boolean {
  if (isAborted(err)) return false;
  if (!(err instanceof ApiError)) return err instanceof TypeError;
  if (err.status === TOO_MANY_REQUESTS) return true;
  return err.status >= FIRST_SERVER_ERROR && err.code === undefined;
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
