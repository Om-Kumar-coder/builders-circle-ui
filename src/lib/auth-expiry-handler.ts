/**
 * Global auth expiry handler.
 * Manages a queue of failed requests and re-executes them after re-auth.
 * Import and call `setupExpiryHandler` once at app startup.
 */

type QueueEntry = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

let isRefreshing = false;
const queue: QueueEntry[] = [];

/** Callbacks registered by the UI to show/hide the re-auth modal */
let onExpiredCallback: (() => void) | null = null;
let onResumedCallback: (() => void) | null = null;

/** Last known user email — set by AuthContext on login, used by relogin fallback */
let _cachedEmail: string | null = null;

export function setCachedEmail(email: string | null) {
  _cachedEmail = email;
  if (email && typeof window !== 'undefined') {
    localStorage.setItem('_reauth_email', email);
  }
}

export function getCachedEmail(): string | null {
  if (_cachedEmail) return _cachedEmail;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('_reauth_email');
  }
  return null;
}

export function registerExpiryCallbacks(
  onExpired: () => void,
  onResumed: () => void,
) {
  onExpiredCallback = onExpired;
  onResumedCallback = onResumed;
}

/** Called by the API client when it receives a 401 */
export function handleTokenExpiry(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    queue.push({ resolve, reject });

    if (!isRefreshing) {
      isRefreshing = true;
      // Notify the UI to show the re-auth modal
      onExpiredCallback?.();
    }
  });
}

/** Called by the re-auth modal on successful password verification */
export function onReAuthSuccess(_newToken: string) {
  isRefreshing = false;
  // Flush the queue — cookie is refreshed by the server, just unblock waiters
  queue.splice(0).forEach(({ resolve }) => resolve(null));
  onResumedCallback?.();
}

/** Called when the user dismisses the re-auth modal without completing */
export function onReAuthDismissed() {
  isRefreshing = false;
  onExpiredCallback = null;
  onResumedCallback = null;
  // Reject all queued requests
  queue.splice(0).forEach(({ reject }) =>
    reject(new Error('Session expired. Please log in again.')),
  );
  // Hard redirect to login
  window.location.href = '/login';
}

export function isReAuthInProgress() {
  return isRefreshing;
}