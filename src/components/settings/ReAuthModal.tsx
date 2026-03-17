'use client';

import { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ReAuthModalProps {
  title?: string;
  description?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function ReAuthModal({
  title = 'Re-authenticate',
  description = 'Enter your password to continue.',
  onSuccess,
  onClose,
}: ReAuthModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.verifyPassword(password);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">{description}</p>
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
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Confirm'}
          </button>
        </form>
      </div>
    </div>
  );
}
