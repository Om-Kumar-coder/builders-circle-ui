'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import SecurityLabelBadge from '@/components/docs/SecurityLabelBadge';
import GrantDocAccessModal from '@/components/docs/GrantDocAccessModal';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Plus, Upload, Shield, Users, Activity, Trash2,
  Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import type { DocumentMeta, DocumentActivity, DocumentAccess } from '@/types/docs';
import type { SecurityLabel } from '@/types/docs';

// ── Upload form ───────────────────────────────────────────────────────────────

function UploadDocForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState<SecurityLabel>('internal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Please select a file'); return; }
    setLoading(true);
    setError(null);
    try {
      await apiClient.adminCreateDoc({ title, file, securityLabel: label });
      setTitle(''); setFile(null); setOpen(false);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-200 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-400" />
          Add Document
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 border-t border-gray-800">
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">File * (PDF, PNG, JPEG — max 20 MB)</label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 file:mr-2 file:text-xs file:bg-indigo-600 file:text-white file:border-0 file:rounded file:px-2 file:py-1"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Security label</label>
              <select value={label} onChange={(e) => setLabel(e.target.value as SecurityLabel)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                <option value="internal">Internal</option>
                <option value="restricted">Restricted</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Document'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Activity drawer ───────────────────────────────────────────────────────────

function ActivityDrawer({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [activity, setActivity] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getDocActivity(docId).then(setActivity).finally(() => setLoading(false));
  }, [docId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-900 border-l border-gray-800 h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100">Activity Log</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Close</button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="bg-gray-800 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-200">{a.user?.email ?? a.userId}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                    ${a.action === 'view' ? 'bg-blue-900/40 text-blue-300' :
                      a.action === 'download' ? 'bg-green-900/40 text-green-300' :
                      a.action.includes('denied') ? 'bg-red-900/40 text-red-300' :
                      'bg-gray-700 text-gray-300'}`}>
                    {a.action}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(a.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Access drawer ─────────────────────────────────────────────────────────────

function AccessDrawer({ docId, docTitle, onClose }: { docId: string; docTitle: string; onClose: () => void }) {
  const [grants, setGrants] = useState<DocumentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient.getDocAccessGrants(docId).then(setGrants).finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  async function revoke(userId: string) {
    setRevoking(userId);
    try {
      await apiClient.adminRevokeDocAccess(userId, docId);
      load();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-900 border-l border-gray-800 h-full overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100">Access Grants</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowGrant(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
              + Grant
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Close</button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : grants.length === 0 ? (
          <p className="text-sm text-gray-500">No access grants</p>
        ) : (
          <div className="space-y-2">
            {grants.map((g) => {
              const expired = g.expiresAt && new Date(g.expiresAt) < new Date();
              const revoked = !!g.revokedAt;
              return (
                <div key={g.id} className={`bg-gray-800 rounded-lg px-3 py-2.5 ${revoked || expired ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-200">{g.user?.email}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                        ${g.accessType === 'download' ? 'bg-green-900/40 text-green-300' : 'bg-blue-900/40 text-blue-300'}`}>
                        {g.accessType}
                      </span>
                      {!revoked && !expired && (
                        <button
                          onClick={() => revoke(g.userId)}
                          disabled={revoking === g.userId}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {revoked ? 'Revoked' : expired ? 'Expired' : g.expiresAt
                      ? `Expires ${new Date(g.expiresAt).toLocaleDateString()}`
                      : 'No expiry'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {showGrant && (
          <GrantDocAccessModal
            documentId={docId}
            documentTitle={docTitle}
            onClose={() => setShowGrant(false)}
            onSuccess={() => { setShowGrant(false); load(); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminDocsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityDocId, setActivityDocId] = useState<string | null>(null);
  const [accessDoc, setAccessDoc] = useState<DocumentMeta | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role !== 'admin' && user?.role !== 'founder') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getDocs();
      setDocs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function toggleActive(doc: DocumentMeta) {
    await apiClient.adminUpdateDoc(doc.id, { isActive: !doc.isActive });
    loadDocs();
  }

  return (
    <MainLayout title="Admin · Docs Vault">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-indigo-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-100">Docs Vault</h1>
              <p className="text-sm text-gray-400">Manage documents, access, and audit logs</p>
            </div>
          </div>
          <button onClick={loadDocs} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Upload form */}
        <UploadDocForm onSuccess={loadDocs} />

        {/* Documents table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">{docs.length} Documents</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No documents yet</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-100 truncate">{doc.title}</span>
                      <SecurityLabelBadge label={doc.securityLabel} />
                      {!doc.isActive && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.mimeType} · {doc.folder?.name ?? 'No folder'} · {doc._count?.versions ?? 1} version(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setActivityDocId(doc.id)}
                      title="Activity log"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAccessDoc(doc)}
                      title="Manage access"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(doc)}
                      title={doc.isActive ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {doc.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activityDocId && (
        <ActivityDrawer docId={activityDocId} onClose={() => setActivityDocId(null)} />
      )}
      {accessDoc && (
        <AccessDrawer
          docId={accessDoc.id}
          docTitle={accessDoc.title}
          onClose={() => setAccessDoc(null)}
        />
      )}
    </MainLayout>
  );
}
