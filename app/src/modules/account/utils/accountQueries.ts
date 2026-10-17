import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { CurrentUserDto } from '@/api/schema';

/**
 * Everything about the signed-in account. A change to how it signs in
 * refreshes all of it, the profile included, which shows the second factor
 * and whether a password is set.
 */
export const accountKeys = {
  all: ['account'] as const,
  me: () => [...accountKeys.all, 'me'] as const,
  mfa: () => [...accountKeys.all, 'mfa'] as const,
  passkeys: () => [...accountKeys.all, 'passkeys'] as const,
  sessions: () => [...accountKeys.all, 'sessions'] as const,
  signInMethods: () => [...accountKeys.all, 'sign-in-methods'] as const,
  providers: () => [...accountKeys.all, 'providers'] as const,
};

/** The signed-in user, or `null` without a session. */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: accountKeys.me(),
    queryFn: (): Promise<CurrentUserDto | null> => unwrap(api.GET('/auth/me')),
  });

export const mfaStatusQuery = () =>
  queryOptions({
    queryKey: accountKeys.mfa(),
    queryFn: () => unwrap(api.GET('/mfa/status')),
  });

export const passkeysQuery = () =>
  queryOptions({
    queryKey: accountKeys.passkeys(),
    queryFn: () => unwrap(api.GET('/passkeys')),
  });

export const sessionsQuery = () =>
  queryOptions({
    queryKey: accountKeys.sessions(),
    queryFn: () => unwrap(api.GET('/auth/sessions')),
  });

export const signInMethodsQuery = () =>
  queryOptions({
    queryKey: accountKeys.signInMethods(),
    queryFn: () => unwrap(api.GET('/auth/sign-in-methods')),
  });

export const linkedProvidersQuery = () =>
  queryOptions({
    queryKey: accountKeys.providers(),
    queryFn: () => unwrap(api.GET('/auth/providers')),
  });
