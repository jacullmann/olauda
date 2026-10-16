import { describe, expect, it } from 'vitest';
import { isStrongPassword } from './password';

describe('isStrongPassword', () => {
  it('needs at least 12 characters of any kind', () => {
    expect(isStrongPassword('abcdefghijk')).toBe(false);
    expect(isStrongPassword('abcdefghijkl')).toBe(true);
    expect(isStrongPassword('123456789012')).toBe(true);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(isStrongPassword('😀😀😀😀😀😀')).toBe(false);
  });
});
