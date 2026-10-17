import { describe, expect, it } from 'vitest';
import { ApiError, isTransientFailure } from './errors';

const failure = (status: number, code?: string) =>
  new ApiError(status, { error: 'debug text', code });

describe('isTransientFailure', () => {
  it('retries what passes on its own', () => {
    expect(isTransientFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransientFailure(failure(502))).toBe(true);
    expect(isTransientFailure(failure(429, 'RATE_LIMITED'))).toBe(true);
  });

  it('does not retry server errors the API names', () => {
    expect(isTransientFailure(failure(503, 'SHUTDOWN'))).toBe(false);
    expect(isTransientFailure(failure(502, 'RESEND_NOT_CONFIGURED'))).toBe(
      false,
    );
  });

  it('does not retry refusals or aborts', () => {
    expect(isTransientFailure(failure(403, 'REAUTH_REQUIRED'))).toBe(false);
    expect(isTransientFailure(failure(404))).toBe(false);
    expect(isTransientFailure(new DOMException('', 'AbortError'))).toBe(false);
  });
});
