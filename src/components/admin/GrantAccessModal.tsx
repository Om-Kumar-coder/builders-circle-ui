'use client';

import { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ACCESS_TYPES = [
  { value: 'feature', label: 'Feature Access' },
  { value: 'cycle_access', label: 'Cycle Access' },
  { value: 'role', label: 'Temporary Role' },
  { value: 'admin_panel', label: 'Admin Panel' },
  { value: 'analytics', label: 'Analytics' },
];

interface GrantAccessModalProps {
  userId: string;
  userName: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function GrantAccessModal({ userId, userName, onSuccess, onClose }: GrantAccessModalProps) {
  const [type, setType] = useState('feature');
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (expiresAt && new Date(expiresAt) <= new Date()) {
      setError('Expiry date must be in the future.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.adminGrantAccess({
        userId,
        type,
        value: value || undefined,
        expiresAt: expiresAt || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  }

  // Min datetime for the picker — now + 1 minute
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Grant Access</h2>
              <p className="text-sm text-gray-400">{userName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Access Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ACCESS_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Value <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="e.g. cycle ID, role name, feature key"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Expiry Date/Time <span className="text-gray-500">(leave blank for permanent)</span>
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              min={minDateTime}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
