'use client';

import { useState } from 'react';
import { Calendar, PauseCircle, CheckCircle, LogOut } from 'lucide-react';
import { useLeaveStatus, useMyLeaves } from '@/hooks/useLeave';
import { apiClient } from '@/lib/api-client';

interface Props {
  cycleId: string;
}

export default function ParticipationStatusCard({ cycleId }: Props) {
  const { onLeave, leave, loading, refetch } = useLeaveStatus(cycleId);
  const { leaves } = useMyLeaves();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!form.startDate || !form.endDate) {
      setError('Start and end dates are required.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await apiClient.requestLeave({ cycleId, ...form });
      setShowForm(false);
      setForm({ startDate: '', endDate: '', reason: '' });
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request leave');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-32 bg-gray-800 rounded-xl animate-pulse border border-gray-700" />;
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Participation</h3>
        {onLeave ? (
          <span className="flex items-center gap-1.5 text-xs bg-orange-900 text-orange-300 px-2 py-1 rounded-full font-medium">
            <PauseCircle size={12} /> On Leave
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full font-medium">
            <CheckCircle size={12} /> Active
          </span>
        )}
      </div>

      {onLeave && leave && (
        <div className="text-sm text-gray-300 bg-orange-950/30 border border-orange-800/40 rounded-lg p-3 space-y-1">
          <p className="flex items-center gap-2">
            <Calendar size={13} className="text-orange-400" />
            {new Date(leave.leaveStart!).toLocaleDateString()} – {new Date(leave.leaveEnd!).toLocaleDateString()}
          </p>
          {leave.reason && <p className="text-gray-400 text-xs">{leave.reason}</p>}
        </div>
      )}

      {!onLeave && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-gray-600 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <LogOut size={14} /> Request Leave
        </button>
      )}

      {showForm && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <textarea
            placeholder="Reason (optional)"
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {leaves.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Leave history</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {leaves.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs text-gray-400 bg-gray-750 rounded px-2 py-1">
                <span>{l.cycle?.name ?? l.cycleId}</span>
                <span>{l.leaveStart ? new Date(l.leaveStart).toLocaleDateString() : '—'} – {l.leaveEnd ? new Date(l.leaveEnd).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
