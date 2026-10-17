import { effectScope } from 'vue';
import { QueryClient } from '@tanstack/vue-query';
import { isTransientFailure } from './errors';

/** Retries cover a deploy restarting the API; anything else will not pass. */
const MAX_RETRIES = 2;

/**
 * The cache of everything the app loaded from the API. Live updates keep it
 * current, so data counts as fresh for a while instead of being refetched on
 * every mount; focus and reconnect still refetch what went stale meanwhile.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failures, error) =>
        failures < MAX_RETRIES && isTransientFailure(error),
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Where observers of app-wide server state live, such as the session's: they
 * are created outside any component and last as long as the app.
 */
export const appScope = effectScope(true);
