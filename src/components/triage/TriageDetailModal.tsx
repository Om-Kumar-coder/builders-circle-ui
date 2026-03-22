'use client';

import { X, ExternalLink } from 'lucide-react';
import type { TriageSubmission } from '@/hooks/useTriage';

interface TriageDetailModalProps {
  submission: TriageSubmission;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export default function TriageDetailModal({ submission, onClose, onApprove, onReject }: TriageDetailModalProps) {
  const isPending = submission.status === 'PENDING';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <h2 className="text-lg font-semibold text-gray-100">Application Detail</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500 mb-0.5">Name</p><p className="text-gray-100">{submission.name}</p></div>
              <div><p className="text-gray-500 mb-0.5">Email</p><p className="text-gray-100">{submission.email}</p></div>
              <div><p className="text-gray-500 mb-0.5">Role Type</p><p className="text-gray-100 capitalize">{submission.roleType}</p></div>
              <div><p className="text-gray-500 mb-0.5">Submission Type</p><p className="text-gray-100 capitalize">{submission.submissionType}</p></div>
              {submission.availability && (
                <div><p className="text-gray-500 mb-0.5">Availability</p><p className="text-gray-100">{submission.availability}</p></div>
              )}
              <div><p className="text-gray-500 mb-0.5">Submitted</p><p className="text-gray-100">{new Date(submission.createdAt).toLocaleString()}</p></div>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Description</p>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800/50 rounded-lg p-3">{submission.description}</p>
            </div>
            {submission.proofLinks && submission.proofLinks.length > 0 && (
              <div>
                <p className="text-gray-500 text-sm mb-2">Proof Links</p>
                <div className="space-y-1">
                  {submission.proofLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                      <ExternalLink size={13} />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {submission.rejectionNote && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium mb-1">Rejection Note</p>
                <p className="text-sm text-red-300">{submission.rejectionNote}</p>
              </div>
            )}
          </div>
          {isPending && (
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={onReject} className="flex-1 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm font-medium transition-colors">
                Reject
              </button>
              <button onClick={onApprove} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
