import { describe, expect, it } from 'vitest';
import { isStrongPassword } from './password';

describe('isStrongPassword', () => {
  it('needs at least 8 characters', () => {
    expect(isStrongPassword('abcdef1')).toBe(false);
    expect(isStrongPassword('abcdefg1')).toBe(true);
  });

  it('needs letters and digits', () => {
    expect(isStrongPassword('abcdefgh')).toBe(false);
    expect(isStrongPassword('12345678')).toBe(false);
    expect(isStrongPassword('äöüßäöü1')).toBe(true);
  });
});
