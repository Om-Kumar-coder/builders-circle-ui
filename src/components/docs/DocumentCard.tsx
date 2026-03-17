'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Lock, Clock, CheckCircle, Download, AlertCircle } from 'lucide-react';
import SecurityLabelBadge from './SecurityLabelBadge';
import RequestAccessModal from './RequestAccessModal';
import type { DocumentMeta } from '@/types/docs';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export default function DocumentCard({
  doc,
  onAccessRequested,
}: {
  doc: DocumentMeta;
  onAccessRequested?: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [requested, setRequested] = useState(false);

  const hasAccess = !!doc.access;
  const days = daysUntil(doc.access?.expiresAt ?? null);
  const expired = days !== null && days <= 0;
  const expiringSoon = days !== null && days > 0 && days <= 3;
  const canDownload = doc.access?.type === 'download';
  const effectiveAccess = hasAccess && !expired;

  return (
    <>
      <div
        className={`relative rounded-xl border p-4 transition-all
          ${effectiveAccess
            ? 'bg-gray-900 border-gray-700 hover:border-indigo-600'
            : 'bg-gray-900/50 border-gray-800 opacity-70'
          }`}
      >
        {/* Blur overlay for locked / expired docs */}
        {!effectiveAccess && (
          <div className="absolute inset-0 rounded-xl backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-1 text-gray-500">
              {expired ? (
                <>
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <span className="text-xs text-red-400">Access expired</span>
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  <span className="text-xs">Restricted</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-900/30 shrink-0">
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <SecurityLabelBadge label={doc.securityLabel} />
              {expiringSoon && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                  <Clock className="w-3 h-3" /> {days}d left
                </span>
              )}
              {expired && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" /> Expired
                </span>
              )}
              {effectiveAccess && !expiringSoon && (
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              )}
              {canDownload && effectiveAccess && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                  <Download className="w-3 h-3" /> Download
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium text-gray-100 truncate">{doc.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {doc.mimeType.split('/').pop()?.toUpperCase()} · {formatSize(doc.size)}
              {doc._count?.versions && doc._count.versions > 1
                ? ` · v${doc._count.versions}`
                : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {effectiveAccess ? (
            <Link
              href={`/docs/view/${doc.id}`}
              className="flex-1 text-center text-xs py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              View
            </Link>
          ) : requested ? (
            <span className="flex-1 text-center text-xs py-1.5 rounded-lg bg-gray-800 text-green-400">
              Request sent
            </span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 text-center text-xs py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              {expired ? 'Re-request Access' : 'Request Access'}
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <RequestAccessModal
          documentId={doc.id}
          documentTitle={doc.title}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            setRequested(true);
            onAccessRequested?.();
          }}
        />
      )}
    </>
  );
}
