'use client';

import { Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { TriageSubmission } from '@/hooks/useTriage';
import VeronicaBadge from '@/components/gatekeeper/VeronicaBadge';

const STATUS_STYLES = {
  PENDING: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40',
  APPROVED: 'bg-green-900/30 text-green-400 border-green-800/40',
  REJECTED: 'bg-red-900/30 text-red-400 border-red-800/40',
};

interface TriageTableProps {
  submissions: TriageSubmission[];
  onView: (s: TriageSubmission) => void;
  onApprove: (s: TriageSubmission) => void;
  onReject: (s: TriageSubmission) => void;
}

export default function TriageTable({ submissions, onView, onApprove, onReject }: TriageTableProps) {
  if (submissions.length === 0) {
    return <p className="text-center text-gray-500 py-12">No submissions found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Veronica</th>
            <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {submissions.map(s => (
            <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
              <td className="py-3 pr-4 text-gray-200 font-medium">{s.name}</td>
              <td className="py-3 pr-4 text-gray-400">{s.email}</td>
              <td className="py-3 pr-4 text-gray-400 capitalize">{s.roleType}</td>
              <td className="py-3 pr-4 text-gray-400 capitalize">{s.submissionType}</td>
              <td className="py-3 pr-4 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
              <td className="py-3 pr-4">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[s.status]}`}>
                  {s.status}
                </span>
              </td>
              <td className="py-3 pr-4">
                {s.veronicaReview ? (
                  <div className="flex flex-col gap-1">
                    <VeronicaBadge status={s.veronicaReview.status} score={s.veronicaReview.veronicaScore} />
                    {s.veronicaReview.veronicaFlags && s.veronicaReview.veronicaFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.veronicaReview.veronicaFlags.slice(0, 2).map((f: string) => (
                          <span key={f} className="flex items-center gap-0.5 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-2.5 h-2.5" />{f.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {s.veronicaReview.veronicaFlags.length > 2 && (
                          <span className="text-xs text-gray-500">+{s.veronicaReview.veronicaFlags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </td>
              <td className="py-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => onView(s)} title="View" className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors">
                    <Eye size={15} />
                  </button>
                  {s.status === 'PENDING' && (
                    <>
                      <button onClick={() => onApprove(s)} title="Approve" className="p-1.5 text-green-400 hover:bg-green-900/30 rounded transition-colors">
                        <CheckCircle size={15} />
                      </button>
                      <button onClick={() => onReject(s)} title="Reject" className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors">
                        <XCircle size={15} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
