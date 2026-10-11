export const MIN_PASSWORD_LENGTH = 8;

/** Mirrors the server's rule for new passwords, so it never has to refuse one. */
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /\p{L}/u.test(password) &&
    /[0-9]/.test(password)
  );
}
