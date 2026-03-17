'use client';

import { useState, useEffect } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { registerExpiryCallbacks, onReAuthSuccess, onReAuthDismissed, getCachedEmail } from '@/lib/auth-expiry-handler';
import { startSessionTimers, attachActivityListeners } from '@/lib/session-timer';

export default function ForceReAuthModal() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    registerExpiryCallbacks(
      () => { setVisible(true); setPassword(''); setError(''); },
      () => { setVisible(false); },
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const email = getCachedEmail() ?? undefined;
      const token = await apiClient.reLogin(password, email);
      if (token) {
        document.cookie = `auth_token=${token}; path=/; max-age=604800; SameSite=Lax`;
      }
      onReAuthSuccess(token);
      startSessionTimers();
      attachActivityListeners();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    onReAuthDismissed();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 p-6 border-b border-gray-800">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Lock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Session expired</h2>
            <p className="text-xs text-gray-400 mt-0.5">Re-enter your password to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            placeholder="Your password"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-gray-400 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
