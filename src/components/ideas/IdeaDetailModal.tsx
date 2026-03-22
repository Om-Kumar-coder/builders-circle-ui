'use client';

import { X, ExternalLink } from 'lucide-react';
import IdeaStatusBadge from './IdeaStatusBadge';
import type { Idea } from '@/hooks/useIdeas';

interface IdeaDetailModalProps {
  idea: Idea;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function IdeaDetailModal({ idea, onClose, onApprove, onReject }: IdeaDetailModalProps) {
  const isPending = idea.status === 'PENDING';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-100 truncate">{idea.title}</h2>
              <IdeaStatusBadge status={idea.status} />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors shrink-0" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {idea.submitter && (
              <div className="text-sm">
                <span className="text-gray-500">Submitted by </span>
                <span className="text-gray-200">{idea.submitter.name || idea.submitter.email}</span>
                <span className="text-gray-500"> · {new Date(idea.createdAt).toLocaleString()}</span>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-800/50 rounded-lg p-3">{idea.description}</p>
            </div>
            {idea.attachments && idea.attachments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
                <div className="space-y-1">
                  {idea.attachments.map((a, i) => (
                    <a key={i} href={a} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                      <ExternalLink size={13} />
                      <span className="truncate">{a}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {idea.cycle && (
              <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 text-sm">
                <span className="text-green-400 font-medium">Cycle created: </span>
                <span className="text-green-300">{idea.cycle.name}</span>
              </div>
            )}
            {idea.rejectionNote && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium mb-1">Rejection Note</p>
                <p className="text-sm text-red-300">{idea.rejectionNote}</p>
              </div>
            )}
          </div>
          {isPending && (onApprove || onReject) && (
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              {onReject && (
                <button onClick={onReject} className="flex-1 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-sm font-medium transition-colors">
                  Reject
                </button>
              )}
              {onApprove && (
                <button onClick={onApprove} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
