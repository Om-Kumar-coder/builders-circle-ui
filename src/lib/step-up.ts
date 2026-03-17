/**
 * Step-up authentication token management.
 * Tokens are stored in sessionStorage (cleared on tab close).
 */

const KEY = 'step_up_token';
const EXPIRY_KEY = 'step_up_expires';
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function getStepUpToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(KEY);
  const expires = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);
  if (!token || Date.now() > expires) {
    clearStepUpToken();
    return null;
  }
  return token;
}

export function setStepUpToken(token: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + TTL_MS));
}

export function clearStepUpToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
}

export function isStepUpValid(): boolean {
  return getStepUpToken() !== null;
}

/** Remaining TTL in seconds, or 0 if expired */
export function stepUpSecondsRemaining(): number {
  if (typeof window === 'undefined') return 0;
  const expires = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);
  return Math.max(0, Math.round((expires - Date.now()) / 1000));
}
