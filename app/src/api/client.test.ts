import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type * as ClientModule from './client';
import { ApiError } from './errors';
import { setReauthHandler } from './reauth';

const BASE_URL = 'http://api.test';

type Reply = { status: number; body?: unknown };

const NO_CONTENT: Reply = { status: 204 };
const ACCESS_TOKEN_EXPIRED: Reply = {
  status: 401,
  body: {
    error: 'Access token is invalid or has expired.',
    code: 'AUTH_REQUIRED',
  },
};
const REFRESH_REFUSED: Reply = {
  status: 401,
  body: { error: 'Refresh token invalid.' },
};
const SHUTDOWN: Reply = {
  status: 503,
  body: { error: 'The platform is shut down.', code: 'SHUTDOWN' },
};
const REAUTH_REQUIRED: Reply = {
  status: 403,
  body: {
    error: "Please confirm it's you to continue.",
    code: 'REAUTH_REQUIRED',
  },
};

let client: typeof ClientModule;

/** Answers every request with `reply` and records the paths called. */
function serve(reply: (path: string, call: number) => Reply): Request[] {
  const requests: Request[] = [];

  vi.stubGlobal('fetch', (request: Request) => {
    requests.push(request);
    const path = new URL(request.url).pathname;
    const call = requests.filter(
      (r) => new URL(r.url).pathname === path,
    ).length;
    const { status, body } = reply(path, call);
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  return requests;
}

const pathsOf = (requests: Request[]) =>
  requests.map((request) => new URL(request.url).pathname);

function countEvents(type: string): () => number {
  let count = 0;
  window.addEventListener(type, () => count++);
  return () => count;
}

const countSignOuts = (): (() => number) => countEvents('auth-expired');

const deleteTodo = () =>
  client.unwrap(
    client.default.DELETE('/todos/{id}', {
      params: { path: { id: '6f0c1c1e-0000-4000-8000-000000000000' } },
    }),
  );

beforeAll(async () => {
  vi.stubEnv('VITE_API_URL', BASE_URL);
  client = await import('./client');
});

beforeEach(() => {
  const window = Object.assign(new EventTarget(), {
    location: { origin: 'http://app.test' },
  });
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { cookie: '' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setReauthHandler(null);
});

describe('api', () => {
  it('refreshes once for parallel requests whose access token expired, then retries them', async () => {
    const requests = serve((path, call) =>
      path.startsWith('/todos') && call <= 2
        ? ACCESS_TOKEN_EXPIRED
        : NO_CONTENT,
    );

    await Promise.all([deleteTodo(), deleteTodo()]);

    const paths = pathsOf(requests);
    expect(paths.filter((path) => path === '/auth/refresh')).toHaveLength(1);
    expect(paths.filter((path) => path.startsWith('/todos'))).toHaveLength(4);
  });

  it('does not refresh for a 401 that is not about the access token', async () => {
    const requests = serve(() => ({
      status: 401,
      body: { error: 'Invalid credentials.', code: 'INVALID_CREDENTIALS' },
    }));
    const signOuts = countSignOuts();

    const login = client.unwrap(
      client.default.POST('/auth/login', {
        body: { email: 'a@example.com', password: 'wrong' },
      }),
    );

    await expect(login).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(pathsOf(requests)).toEqual(['/auth/login']);
    expect(signOuts()).toBe(0);
  });

  it('signs out once when the server refuses the refresh', async () => {
    serve((path) =>
      path === '/auth/refresh' ? REFRESH_REFUSED : ACCESS_TOKEN_EXPIRED,
    );
    const signOuts = countSignOuts();

    const results = await Promise.allSettled([deleteTodo(), deleteTodo()]);

    expect(results.every(({ status }) => status === 'rejected')).toBe(true);
    expect(signOuts()).toBe(1);
  });

  it('keeps the session when the refresh fails without an answer on the session', async () => {
    serve((path) =>
      path === '/auth/refresh' ? { status: 503 } : ACCESS_TOKEN_EXPIRED,
    );
    const signOuts = countSignOuts();

    await expect(deleteTodo()).rejects.toBeInstanceOf(ApiError);
    expect(signOuts()).toBe(0);
  });

  it('reports shutdown without refreshing or retrying', async () => {
    const requests = serve(() => SHUTDOWN);
    const signOuts = countSignOuts();
    const shutdown = countEvents('shutdown');

    await expect(deleteTodo()).rejects.toMatchObject({ code: 'SHUTDOWN' });
    expect(requests).toHaveLength(1);
    expect(shutdown()).toBe(1);
    expect(signOuts()).toBe(0);
  });

  it('reports a mute with the group it applies to', async () => {
    serve(() => ({
      status: 403,
      body: {
        error: 'You are muted in this group.',
        code: 'MUTED_IN_GROUP',
        groupId: 'group-1',
      },
    }));
    const mutedGroups: unknown[] = [];
    window.addEventListener('group-muted', (event) => {
      if (event instanceof CustomEvent) mutedGroups.push(event.detail);
    });

    await expect(deleteTodo()).rejects.toBeInstanceOf(ApiError);
    expect(mutedGroups).toEqual(['group-1']);
  });

  it('keeps the session when shutdown turns the refresh away', async () => {
    serve((path) =>
      path === '/auth/refresh' ? SHUTDOWN : ACCESS_TOKEN_EXPIRED,
    );
    const signOuts = countSignOuts();
    const shutdown = countEvents('shutdown');

    await expect(deleteTodo()).rejects.toBeInstanceOf(ApiError);
    expect(shutdown()).toBe(1);
    expect(signOuts()).toBe(0);
  });

  it('leaves the consequences of a refused refresh to callers of refreshSession', async () => {
    serve(() => REFRESH_REFUSED);
    const signOuts = countSignOuts();

    await expect(client.refreshSession()).rejects.toBeInstanceOf(ApiError);
    expect(signOuts()).toBe(0);
  });

  it('repeats a sensitive request once the user confirmed who they are', async () => {
    const requests = serve((path, call) =>
      path.startsWith('/todos') && call === 1 ? REAUTH_REQUIRED : NO_CONTENT,
    );
    setReauthHandler(() => Promise.resolve(true));

    await expect(deleteTodo()).resolves.toBeUndefined();
    expect(requests).toHaveLength(2);
  });

  it('asks for a confirmation only once per request', async () => {
    const requests = serve(() => REAUTH_REQUIRED);
    const confirm = vi.fn(() => Promise.resolve(true));
    setReauthHandler(confirm);

    await expect(deleteTodo()).rejects.toMatchObject({
      code: 'REAUTH_REQUIRED',
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
  });

  it('repeats the CSRF cookie as a header', async () => {
    const requests = serve(() => NO_CONTENT);
    vi.stubGlobal('document', { cookie: 'theme=dark; csrf_token=abc%3D' });

    await deleteTodo();

    expect(requests[0]?.headers.get('x-csrf-token')).toBe('abc=');
  });
});
