'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { setStepUpToken, stepUpSecondsRemaining, isStepUpValid } from '@/lib/step-up';

interface StepUpModalProps {
  action: string;           // human-readable label e.g. "override ownership"
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StepUpModal({ action, onSuccess, onCancel }: StepUpModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // If a valid step-up token already exists, skip the modal immediately
  useEffect(() => {
    if (isStepUpValid()) {
      onSuccess();
      return;
    }
    inputRef.current?.focus();
  }, [onSuccess]);

  // Live countdown if token exists
  useEffect(() => {
    const id = setInterval(() => setRemaining(stepUpSecondsRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const { token } = await apiClient.requestStepUp(password);
      setStepUpToken(token);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100">Admin verification required</h2>
              <p className="text-xs text-gray-400 mt-0.5">To: {action}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            Confirm your password to proceed. Your elevated access will last{' '}
            <span className="text-indigo-400 font-medium">15 minutes</span>.
          </p>

          {remaining > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5" />
              Elevated access active — {mins}:{String(secs).padStart(2, '0')} remaining
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Confirm & Proceed'}
          </button>
        </form>
      </div>
    </div>
  );
}
