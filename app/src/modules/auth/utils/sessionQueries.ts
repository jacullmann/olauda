import { queryOptions } from '@tanstack/vue-query';
import api, { refreshSession, unwrap } from '@/api/client';
import { isSessionRejected } from '@/api/errors';
import type { GroupStatusDto } from '@/api/schema';

export const sessionKey = ['session'] as const;

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
 * session does: "not authenticated" is final only once a refresh failed too.
 * Every load of the status goes through here, so a refetch can never take a
 * signed-in user for signed out.
 */
async function fetchSessionStatus(): Promise<GroupStatusDto> {
  const status = await unwrap(api.GET('/groups/status'));
  if (status.authenticated || !(await renewSession())) return status;
  return unwrap(api.GET('/groups/status'));
}

/** Whether the user is signed in, with their groups. */
export const sessionStatusQuery = () =>
  queryOptions({ queryKey: sessionKey, queryFn: fetchSessionStatus });
