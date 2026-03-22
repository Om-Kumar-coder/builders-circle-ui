'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ApproveIdeaModalProps {
  ideaTitle: string;
  onConfirm: (options: { cycleName?: string; startDate: string; endDate: string }) => Promise<void>;
  onClose: () => void;
}

export default function ApproveIdeaModal({ ideaTitle, onConfirm, onClose }: ApproveIdeaModalProps) {
  const [cycleName, setCycleName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm({ cycleName: cycleName.trim() || undefined, startDate, endDate });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve idea');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-gray-100">Approve Idea</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400">Approving: <span className="text-gray-200 font-medium">{ideaTitle}</span></p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Cycle Name (optional)</label>
              <input
                type="text"
                value={cycleName}
                onChange={e => setCycleName(e.target.value)}
                placeholder={`Defaults to "${ideaTitle}"`}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={loading || !startDate || !endDate} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {loading ? 'Approving...' : 'Approve & Create Cycle'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
