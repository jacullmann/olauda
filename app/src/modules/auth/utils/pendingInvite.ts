/**
 * Persists an invite token across the login / registration flow so the user
 * lands straight on the join prompt once they are authenticated.
 *
 * localStorage (not sessionStorage) is used on purpose: registration involves
 * an email verification link that may open in another tab, and OAuth leaves
 * the app entirely.
 */

import type { RouteLocationNamedRaw } from 'vue-router';
import { inviteRoute } from './routes';

const STORAGE_KEY = 'olauda:pending-invite';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Mirrors the server's token format (32 random bytes, hex-encoded).
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

interface StoredInvite {
  token: string;
  savedAt: number;
}

function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

export function savePendingInvite(token: string): void {
  if (!isValidToken(token)) return;
  try {
    const entry: StoredInvite = { token, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage unavailable (private mode, quota, disabled) – degrade silently.
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable – nothing to clear.
  }
}

export function getPendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<StoredInvite>;
    const expired =
      typeof entry.savedAt !== 'number' ||
      Date.now() - entry.savedAt > MAX_AGE_MS;

    if (expired || !isValidToken(entry.token)) {
      clearPendingInvite();
      return null;
    }
    return entry.token;
  } catch {
    clearPendingInvite();
    return null;
  }
}

/** Returns the invite route for a stored token and removes it (one-shot). */
export function consumePendingInviteRoute(): RouteLocationNamedRaw | null {
  const token = getPendingInvite();
  if (!token) return null;
  clearPendingInvite();
  return inviteRoute(token);
}
