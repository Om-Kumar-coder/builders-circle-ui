'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import WatermarkOverlay from '@/components/security/WatermarkOverlay';
import SecurityLabelBadge from '@/components/docs/SecurityLabelBadge';
import RequestAccessModal from '@/components/docs/RequestAccessModal';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Shield, Clock, AlertTriangle, ChevronLeft, FileText, Download } from 'lucide-react';
import type { DocumentMeta } from '@/types/docs';
import PdfCanvasViewer from '@/components/docs/PdfCanvasViewer';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export default function DocViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiClient
      .getDocMeta(id)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobError, setBlobError] = useState(false);

  const hasAccess = isAdmin || !!doc?.access;
  const canDownload = isAdmin || doc?.access?.type === 'download';
  const days = daysUntil(doc?.access?.expiresAt ?? null);
  const expiringSoon = days !== null && days <= 3;
  const isPdf = doc?.mimeType === 'application/pdf';
  const isImage = doc?.mimeType?.startsWith('image/');

  // Fetch the file as a blob (auth via header, not URL param)
  useEffect(() => {
    if (!id || !hasAccess || (!isPdf && !isImage)) return;
    let objectUrl: string;
    apiClient.getDocBlobUrl(id)
      .then(url => { objectUrl = url; setBlobUrl(url); })
      .catch(() => setBlobError(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, hasAccess, isPdf, isImage]);

  // Prevent right-click on the viewer area
  function blockContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  }

  if (loading) {
    return (
      <MainLayout title="Document Viewer">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </MainLayout>
    );
  }

  if (error || !doc) {
    return (
      <MainLayout title="Document Viewer">
        <div className="text-center py-16 text-red-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
          <p>{error ?? 'Document not found'}</p>
        </div>
      </MainLayout>
    );
  }

  if (blobError) {
    return (
      <MainLayout title="Document Viewer">
        <div className="text-center py-16 text-red-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" />
          <p>Failed to load document. Access may have expired.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={doc.title}>
      {/* Watermark is ALWAYS shown on the viewer — forced regardless of route */}
      <WatermarkOverlay forceShow />

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Vault
        </button>

        {/* Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-900/30">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-100">{doc.title}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <SecurityLabelBadge label={doc.securityLabel} />
                  {doc.folder && (
                    <span className="text-xs text-gray-500">{doc.folder.name}</span>
                  )}
                  {doc._count?.versions && doc._count.versions > 1 && (
                    <span className="text-xs text-gray-500">v{doc._count.versions}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-gray-400">
                {canDownload ? 'Download access · Watermarked' : 'View-only · Watermarked'}
              </span>
              {canDownload && (
                <button
                  onClick={async () => {
                    try {
                      await apiClient.downloadDoc(doc.id, doc.title);
                    } catch {
                      alert('Download failed. Please try again.');
                    }
                  }}
                  className="ml-2 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              )}
            </div>
          </div>

          {/* Access status */}
          {hasAccess && doc.access?.expiresAt && (
            <div
              className={`mt-4 flex items-center gap-2 text-sm px-3 py-2 rounded-lg
                ${expiringSoon ? 'bg-yellow-900/20 text-yellow-300 border border-yellow-800' : 'bg-gray-800 text-gray-400'}`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              {expiringSoon
                ? `Access expires in ${days} day${days === 1 ? '' : 's'}`
                : `Access expires ${new Date(doc.access.expiresAt).toLocaleDateString()}`}
            </div>
          )}
        </div>

        {/* Viewer or Access Gate */}
        {hasAccess ? (
          <div
            className="relative bg-gray-950 border border-gray-800 rounded-xl overflow-hidden"
            onContextMenu={blockContextMenu}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {isPdf && (
              canDownload ? (
                <iframe
                  src={blobUrl ?? undefined}
                  title={doc.title}
                  className="w-full"
                  style={{ height: '80vh', border: 'none' }}
                />
              ) : blobUrl ? (
                <PdfCanvasViewer blobUrl={blobUrl} />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                </div>
              )
            )}
            {isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blobUrl ?? undefined}
                alt={doc.title}
                className="w-full object-contain max-h-[80vh] pointer-events-none"
                draggable={false}
              />
            )}
            {!isPdf && !isImage && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Preview not available for this file type</p>
                <p className="text-xs mt-1">{doc.mimeType}</p>
              </div>
            )}
          </div>
        ) : (
          /* No access — show gate */
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-indigo-400 opacity-60" />
            <h2 className="text-lg font-semibold text-gray-200 mb-2">Access Required</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
              You don&apos;t have permission to view this document. Submit a request and an admin will review it.
            </p>
            {requestSent ? (
              <div className="inline-flex items-center gap-2 text-green-400 text-sm">
                <Shield className="w-4 h-4" /> Request submitted — you&apos;ll be notified when approved
              </div>
            ) : (
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                Request Access
              </button>
            )}
          </div>
        )}
      </div>

      {showRequestModal && (
        <RequestAccessModal
          documentId={doc.id}
          documentTitle={doc.title}
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            setRequestSent(true);
          }}
        />
      )}
    </MainLayout>
  );
}
