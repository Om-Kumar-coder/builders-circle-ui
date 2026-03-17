/**
 * Client-side session timer.
 *
 * Two independent clocks:
 *  - Idle timer   : resets on user activity. Fires warning at IDLE_WARN_MS,
 *                   then expires at IDLE_TIMEOUT_MS.
 *  - Absolute timer: starts when the JWT is stored. Fires warning at
 *                   ABS_WARN_BEFORE_MS before the token's `exp` claim.
 *
 * Both paths show the same SessionWarningModal via registered callbacks.
 */

const IDLE_TIMEOUT_MS  = 30 * 60 * 1000;   // 30 min of inactivity → expire
const IDLE_WARN_MS     = 25 * 60 * 1000;   // warn at 25 min (5 min left)
const ABS_WARN_BEFORE_MS = 5 * 60 * 1000;  // warn 5 min before JWT exp

type Cb = () => void;
type CountdownCb = (secondsLeft: number) => void;

let onWarnCb: CountdownCb | null = null;
let onExpireCb: Cb | null = null;

let idleWarnTimer: ReturnType<typeof setTimeout> | null = null;
let idleExpireTimer: ReturnType<typeof setTimeout> | null = null;
let absWarnTimer: ReturnType<typeof setTimeout> | null = null;
let absExpireTimer: ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let warnExpiresAt = 0; // absolute ms timestamp when session will expire

export function registerSessionCallbacks(onWarn: CountdownCb, onExpire: Cb) {
  onWarnCb = onWarn;
  onExpireCb = onExpire;
}

/** Call this whenever the user successfully authenticates / extends session */
export function startSessionTimers() {
  if (typeof window === 'undefined') return;
  resetIdleTimer();
  scheduleAbsoluteTimer();
}

/** Call on every user interaction to reset the idle clock */
export function resetIdleTimer() {
  if (typeof window === 'undefined') return;
  clearTimeout(idleWarnTimer!);
  clearTimeout(idleExpireTimer!);
  stopCountdown();

  idleWarnTimer = setTimeout(() => {
    warnExpiresAt = Date.now() + (IDLE_TIMEOUT_MS - IDLE_WARN_MS);
    startCountdown();
  }, IDLE_WARN_MS);

  idleExpireTimer = setTimeout(() => {
    stopCountdown();
    onExpireCb?.();
  }, IDLE_TIMEOUT_MS);
}

/** Schedule a warning based on the JWT `exp` claim */
function scheduleAbsoluteTimer() {
  clearTimeout(absWarnTimer!);
  clearTimeout(absExpireTimer!);

  const token = localStorage.getItem('auth_token');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return;

    const expiresAt = payload.exp * 1000; // convert to ms
    const now = Date.now();
    const msUntilExpiry = expiresAt - now;
    const msUntilWarn = msUntilExpiry - ABS_WARN_BEFORE_MS;

    if (msUntilExpiry <= 0) {
      onExpireCb?.();
      return;
    }

    if (msUntilWarn > 0) {
      absWarnTimer = setTimeout(() => {
        warnExpiresAt = expiresAt;
        startCountdown();
      }, msUntilWarn);
    } else {
      // Already in warning window
      warnExpiresAt = expiresAt;
      startCountdown();
    }

    absExpireTimer = setTimeout(() => {
      stopCountdown();
      onExpireCb?.();
    }, msUntilExpiry);
  } catch {
    // Malformed token — ignore
  }
}

function startCountdown() {
  stopCountdown();
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function tick() {
  const secondsLeft = Math.max(0, Math.round((warnExpiresAt - Date.now()) / 1000));
  onWarnCb?.(secondsLeft);
  if (secondsLeft <= 0) stopCountdown();
}

function stopCountdown() {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/** Call when the user extends their session (re-auth or activity) */
export function extendSession() {
  stopCountdown();
  clearTimeout(absWarnTimer!);
  clearTimeout(absExpireTimer!);
  scheduleAbsoluteTimer();
  resetIdleTimer();
}

/** Tear everything down (on logout) */
export function clearSessionTimers() {
  clearTimeout(idleWarnTimer!);
  clearTimeout(idleExpireTimer!);
  clearTimeout(absWarnTimer!);
  clearTimeout(absExpireTimer!);
  stopCountdown();
}

/** Activity events that reset the idle timer */
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const;
let activityListenersAttached = false;

export function attachActivityListeners() {
  if (typeof window === 'undefined' || activityListenersAttached) return;
  activityListenersAttached = true;

  const handler = () => resetIdleTimer();
  ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
}
