'use client';

import { useState, useEffect } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import {
  registerSessionCallbacks,
  startSessionTimers,
  extendSession,
  clearSessionTimers,
  attachActivityListeners,
} from '@/lib/session-timer';
import { apiClient } from '@/lib/api-client';
import { onReAuthDismissed } from '@/lib/auth-expiry-handler';

export default function SessionWarningModal() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    registerSessionCallbacks(
      (secs) => setSecondsLeft(secs),
      () => {
        // Session expired — clear token and redirect via the existing handler
        setSecondsLeft(null);
        onReAuthDismissed();
      },
    );

    // Start timers if a token already exists (page refresh case)
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      startSessionTimers();
      attachActivityListeners();
    }

    return () => clearSessionTimers();
  }, []);

  async function handleExtend() {
    setExtending(true);
    try {
      // Ping /auth/me — if it succeeds the token is still valid; also
      // triggers the 401 → ForceReAuthModal path if it's already expired.
      await apiClient.getCurrentUser();
      extendSession();
      setSecondsLeft(null);
    } catch {
      // 401 will be caught by the api-client and trigger ForceReAuthModal
      setSecondsLeft(null);
    } finally {
      setExtending(false);
    }
  }

  function handleSignOut() {
    clearSessionTimers();
    setSecondsLeft(null);
    onReAuthDismissed();
  }

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  const urgent = secondsLeft <= 60;

  return (
    <div className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-gray-900 border rounded-2xl w-full max-w-sm shadow-2xl transition-colors ${
        urgent ? 'border-red-500/50' : 'border-yellow-500/30'
      }`}>
        <div className={`flex items-center gap-3 p-5 border-b ${
          urgent ? 'border-red-500/30' : 'border-gray-800'
        }`}>
          <div className={`p-2 rounded-lg ${urgent ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
            <Clock className={`w-5 h-5 ${urgent ? 'text-red-400' : 'text-yellow-400'}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-100">Session expiring soon</h2>
            <p className="text-xs text-gray-400 mt-0.5">You'll be signed out due to inactivity</p>
          </div>
          <div className={`text-2xl font-mono font-bold tabular-nums ${
            urgent ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {timeStr}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <button
            onClick={handleExtend}
            disabled={extending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${extending ? 'animate-spin' : ''}`} />
            {extending ? 'Extending...' : 'Stay signed in'}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 text-gray-400 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
