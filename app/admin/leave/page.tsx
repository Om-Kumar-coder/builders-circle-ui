'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useCycle } from '@/context/CycleContext';
import { apiClient } from '@/lib/api-client';
import type { ParticipationLeave } from '@/types/task';
import { PauseCircle, CheckCircle, Plus, RefreshCw } from 'lucide-react';

export default function AdminLeavePage() {
  const { user } = useAuth();
  const { activeCycle } = useCycle();
  const [leaves, setLeaves] = useState<ParticipationLeave[]>([]);
  const [users, setUsers] = useState<{ id: string; name?: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ userId: '', startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.adminGetAllLeaves();
      setLeaves(data);
    } catch {
      setError('Failed to load leave records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    apiClient.getAdminUsers().then(u => setUsers(u)).catch(() => {});
  }, [fetchLeaves]);

  const handleGrant = async () => {
    if (!form.userId || !form.startDate || !form.endDate || !activeCycle) return;
    try {
      setSubmitting(true);
      setError(null);
      await apiClient.adminGrantLeave({ ...form, cycleId: activeCycle.id });
      setForm({ userId: '', startDate: '', endDate: '', reason: '' });
      setShowGrant(false);
      fetchLeaves();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to grant leave');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverride = async (userId: string, cycleId: string, status: 'active' | 'paused') => {
    try {
      await apiClient.adminOverrideParticipation({ userId, cycleId, status });
      fetchLeaves();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to override status');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
    return <MainLayout title="Leave Management"><p className="text-gray-400 p-6">Access denied.</p></MainLayout>;
  }

  return (
    <MainLayout title="Leave Management">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Leave Management</h1>
            <p className="text-sm text-gray-400 mt-1">Grant and manage participation leave</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchLeaves} className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setShowGrant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors">
              <Plus size={15} /> Grant Leave
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-4 py-2">{error}</p>}

        {showGrant && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Grant Leave</h3>
            <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
              <option value="">Select user *</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <textarea placeholder="Reason (optional)" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={handleGrant} disabled={submitting || !form.userId || !form.startDate || !form.endDate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
                {submitting ? 'Granting...' : 'Grant Leave'}
              </button>
              <button onClick={() => setShowGrant(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />)}</div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No leave records found.</div>
        ) : (
          <div className="space-y-3">
            {leaves.map(l => (
              <div key={l.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {l.status === 'paused'
                    ? <PauseCircle size={16} className="text-orange-400 shrink-0" />
                    : <CheckCircle size={16} className="text-green-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {(l as { user?: { name?: string; email?: string } }).user?.name ?? (l as { user?: { name?: string; email?: string } }).user?.email ?? l.userId}
                    </p>
                    <p className="text-xs text-gray-400">
                      {l.cycle?.name ?? l.cycleId} &middot;{' '}
                      {l.leaveStart ? new Date(l.leaveStart).toLocaleDateString() : '—'} –{' '}
                      {l.leaveEnd ? new Date(l.leaveEnd).toLocaleDateString() : '—'}
                    </p>
                    {l.reason && <p className="text-xs text-gray-500 mt-0.5">{l.reason}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {l.status === 'paused' ? (
                    <button onClick={() => handleOverride(l.userId, l.cycleId, 'active')}
                      className="px-3 py-1.5 bg-green-900/50 hover:bg-green-900 text-green-400 text-xs rounded-lg transition-colors">
                      Resume
                    </button>
                  ) : (
                    <button onClick={() => handleOverride(l.userId, l.cycleId, 'paused')}
                      className="px-3 py-1.5 bg-orange-900/50 hover:bg-orange-900 text-orange-400 text-xs rounded-lg transition-colors">
                      Pause
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
