'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, FileText, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Agreement {
  id: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface UserAgreement {
  acceptedAt: string;
  agreementId: string;
}

interface AgreementViewerModalProps {
  onClose: () => void;
  initialAgreementId?: string;
}

export default function AgreementViewerModal({ onClose, initialAgreementId }: AgreementViewerModalProps) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [selected, setSelected] = useState<Agreement | null>(null);
  const [userAcceptances, setUserAcceptances] = useState<UserAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, status] = await Promise.all([
        apiClient.getAgreementHistory(),
        apiClient.getAgreementUserStatus(),
      ]);
      setAgreements(history);

      // Build acceptance list from status (simplified — shows current version acceptance)
      if (status.hasAccepted && status.agreementId) {
        setUserAcceptances([{ acceptedAt: new Date().toISOString(), agreementId: status.agreementId }]);
      }

      const target = initialAgreementId
        ? history.find((a: Agreement) => a.id === initialAgreementId)
        : history.find((a: Agreement) => a.isActive) ?? history[0];
      setSelected(target ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [initialAgreementId]);

  useEffect(() => {
    load();
  }, [load]);

  function getAcceptance(agreementId: string) {
    return userAcceptances.find(u => u.agreementId === agreementId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Agreement Viewer</h2>
              <p className="text-xs text-gray-500">{agreements.length} version{agreements.length !== 1 ? 's' : ''} on record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Version selector */}
            <div className="px-6 pt-4 flex-shrink-0">
              <div className="relative">
                <select
                  value={selected?.id ?? ''}
                  onChange={e => setSelected(agreements.find(a => a.id === e.target.value) ?? null)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {agreements.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.version}{a.isActive ? ' (current)' : ''} — {a.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {selected && (
                <div className="flex items-center gap-3 mt-3">
                  {selected.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full">Active</span>
                  )}
                  {getAcceptance(selected.id) ? (
                    <span className="text-xs text-green-400">
                      ✓ Accepted on {new Date(getAcceptance(selected.id)!.acceptedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Not accepted</span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">
                    Created {new Date(selected.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            {selected && (
              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                <h3 className="text-base font-semibold text-gray-200 mb-3">{selected.title}</h3>
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selected.content}
                </div>
              </div>
            )}
          </>
        )}

        <div className="px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
