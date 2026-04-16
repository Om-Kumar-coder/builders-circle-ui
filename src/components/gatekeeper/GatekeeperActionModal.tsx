'use client';

import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { X, CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  review: any;
  onClose: () => void;
  onSuccess: () => void;
}

type Action = 'APPROVED' | 'REJECTED' | 'SENT_BACK';

export default function GatekeeperActionModal({ review, onClose, onSuccess }: Props) {
  const defaultAction = (): Action | null => {
    if (review.status === 'FLAGGED') return 'REJECTED';
    if (review.status === 'VALID') return 'APPROVED';
    if (review.status === 'NEEDS_REVIEW') return 'SENT_BACK';
    return null;
  };

  const [action, setAction] = useState<Action | null>(defaultAction());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const label = review.entityType === 'user_intake'
    ? (review.triage?.name ?? 'Application')
    : (review.activity?.user?.name ?? 'Submission');

  const handleSubmit = async () => {
    if (!action) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.gatekeeperAction(review.id, action, notes || undefined);
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const actions: { value: Action; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'APPROVED', label: 'Approve — Ready for Admin', icon: CheckCircle, color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
    { value: 'SENT_BACK', label: 'Send Back for Correction', icon: RotateCcw, color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
    { value: 'REJECTED', label: 'Reject', icon: XCircle, color: 'border-red-500 bg-red-500/10 text-red-400' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-white font-semibold">Gatekeeper Action</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Veronica verdict summary */}
          {(review.veronicaScore != null || review.veronicaFlags?.length > 0) && (
            <div className="flex items-start gap-2 p-3 bg-gray-800/60 rounded-lg border border-gray-700 text-xs text-gray-400">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                {review.veronicaScore != null && (
                  <span className="mr-2">AI score: <span className="text-white font-medium">{Math.round(review.veronicaScore * 100)}%</span></span>
                )}
                {review.veronicaFlags?.length > 0 && (
                  <span>Flags: {review.veronicaFlags.join(', ')}</span>
                )}
                {review.veronicaNotes && (
                  <p className="mt-1 italic text-gray-500">{review.veronicaNotes}</p>
                )}
              </div>
            </div>
          )}

          <p className="text-gray-400 text-sm">
            Taking action on: <span className="text-white font-medium">{label}</span>
          </p>

          <div className="space-y-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.value}
                  onClick={() => setAction(a.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    action === a.value ? a.color : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">{a.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add a note for the record..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!action || loading}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
