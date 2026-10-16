import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import api, { refreshSession } from './client';

type Reply = { status: number; data?: unknown };

const ACCESS_TOKEN_EXPIRED: Reply = {
  status: 401,
  data: {
    error: 'Access token is invalid or has expired.',
    requiresAuth: true,
  },
};
const OK: Reply = { status: 200, data: { ok: true } };
const SHUTDOWN: Reply = {
  status: 503,
  data: {
    error: 'The platform is shut down.',
    code: 'SHUTDOWN',
  },
};

/** Answers every request with `reply`, and records which URLs were called. */
function serve(reply: (url: string, call: number) => Reply): string[] {
  const calls: string[] = [];

  api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    calls.push(url);
    const { status, data } = reply(
      url,
      calls.filter((called) => called === url).length,
    );
    const response: AxiosResponse = {
      status,
      data,
      statusText: '',
      headers: {},
      config,
    };
    if (status < 400) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      ),
    );
  };

  return calls;
}

function countEvents(type: string): () => number {
  let count = 0;
  window.addEventListener(type, () => count++);
  return () => count;
}

const countSignOuts = (): (() => number) => countEvents('auth-expired');

beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', { cookie: '' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('refreshes once for parallel requests whose access token expired, then retries them', async () => {
    const calls = serve((url, call) =>
      url === '/data' && call <= 2 ? ACCESS_TOKEN_EXPIRED : OK,
    );

    await Promise.all([api.get('/data'), api.get('/data')]);

    expect(calls.filter((url) => url === '/auth/refresh')).toHaveLength(1);
    expect(calls.filter((url) => url === '/data')).toHaveLength(4);
  });

  it('does not refresh for a 401 that is not about the access token', async () => {
    const calls = serve(() => ({
      status: 401,
      data: { error: 'Invalid credentials.' },
    }));
    const signOuts = countSignOuts();

    await expect(api.post('/auth/login')).rejects.toBeInstanceOf(AxiosError);

    expect(calls).toEqual(['/auth/login']);
    expect(signOuts()).toBe(0);
  });

  it('signs out once when the server refuses the refresh', async () => {
    serve((url) =>
      url === '/auth/refresh'
        ? { status: 401, data: { error: 'Refresh token invalid.' } }
        : ACCESS_TOKEN_EXPIRED,
    );
    const signOuts = countSignOuts();

    const results = await Promise.allSettled([
      api.get('/data'),
      api.get('/data'),
    ]);

    expect(results.every(({ status }) => status === 'rejected')).toBe(true);
    expect(signOuts()).toBe(1);
  });

  it('keeps the session when the refresh fails without an answer on the session', async () => {
    serve((url) =>
      url === '/auth/refresh' ? { status: 503 } : ACCESS_TOKEN_EXPIRED,
    );
    const signOuts = countSignOuts();

    await expect(api.get('/data')).rejects.toBeInstanceOf(AxiosError);

    expect(signOuts()).toBe(0);
  });

  it('reports shutdown without refreshing or retrying', async () => {
    const calls = serve(() => SHUTDOWN);
    const signOuts = countSignOuts();
    const shutdown = countEvents('shutdown');

    await expect(api.get('/data')).rejects.toBeInstanceOf(AxiosError);

    expect(calls).toEqual(['/data']);
    expect(shutdown()).toBe(1);
    expect(signOuts()).toBe(0);
  });

  it('reports a mute with the group it applies to', async () => {
    const calls = serve(() => ({
      status: 403,
      data: {
        error: 'You are muted in this group.',
        code: 'MUTED_IN_GROUP',
        groupId: 'group-1',
      },
    }));
    const signOuts = countSignOuts();
    const mutedGroups: unknown[] = [];
    window.addEventListener('group-muted', (event) => {
      if (event instanceof CustomEvent) mutedGroups.push(event.detail);
    });

    await expect(api.post('/groups/group-1/items')).rejects.toBeInstanceOf(
      AxiosError,
    );

    expect(calls).toEqual(['/groups/group-1/items']);
    expect(mutedGroups).toEqual(['group-1']);
    expect(signOuts()).toBe(0);
  });

  it('keeps the session when shutdown turns the refresh away', async () => {
    serve((url) => (url === '/auth/refresh' ? SHUTDOWN : ACCESS_TOKEN_EXPIRED));
    const signOuts = countSignOuts();
    const shutdown = countEvents('shutdown');

    await expect(api.get('/data')).rejects.toBeInstanceOf(AxiosError);

    expect(shutdown()).toBe(1);
    expect(signOuts()).toBe(0);
  });

  it('leaves the consequences of a refused refresh to callers of refreshSession', async () => {
    serve(() => ({ status: 401, data: { error: 'Refresh token invalid.' } }));
    const signOuts = countSignOuts();

    await expect(refreshSession()).rejects.toBeInstanceOf(AxiosError);

    expect(signOuts()).toBe(0);
  });
});
