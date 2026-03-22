'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useGroups } from '@/hooks/useGroups';

interface AssignGroupModalProps {
  userId: string;
  userName: string;
  currentGroupId?: string | null;
  onSave: (groupId: string | null) => Promise<void>;
  onClose: () => void;
}

export default function AssignGroupModal({ userId: _userId, userName, currentGroupId, onSave, onClose }: AssignGroupModalProps) {
  const { groups, fetchGroups } = useGroups();
  const [selected, setSelected] = useState<string | null>(currentGroupId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign group');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-gray-100">Assign Group</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400">Assigning group for <span className="text-gray-200 font-medium">{userName}</span></p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Group</label>
              <select
                value={selected ?? ''}
                onChange={e => setSelected(e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No group</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}{g.isDefault ? ' (default)' : ''}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
