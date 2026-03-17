'use client';

import { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Props {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption { id: string; email: string; name?: string }

export default function GrantDocAccessModal({ documentId, documentTitle, onClose, onSuccess }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState('');
  const [accessType, setAccessType] = useState<'view' | 'download'>('view');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getAdminUsers().then(setUsers).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { setError('Select a user'); return; }
    setLoading(true);
    setError(null);
    try {
      await apiClient.adminGrantDocAccess({
        userId,
        documentId,
        accessType,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-gray-100">Grant Access</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Document: <span className="text-gray-200 font-medium">{documentTitle}</span>
          </p>

          <div>
            <label className="block text-xs text-gray-400 mb-1">User *</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.email}{u.name ? ` (${u.name})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Access type</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as 'view' | 'download')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="view">View only</option>
              <option value="download">View + Download</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Expires in (days, leave blank = no expiry)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 30"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors disabled:opacity-50">
              {loading ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
