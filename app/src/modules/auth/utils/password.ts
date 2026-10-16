const MIN_PASSWORD_LENGTH = 12;

/** Mirrors the server's rule for new passwords, so it never has to refuse one. */
export function isStrongPassword(password: string): boolean {
  // Counts code points like the server, not UTF-16 units.
  return [...password].length >= MIN_PASSWORD_LENGTH;
}
