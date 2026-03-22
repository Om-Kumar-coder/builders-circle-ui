'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useDocs, useFolders } from '@/hooks/useDocs';
import FolderTree from '@/components/docs/FolderTree';
import DocumentCard from '@/components/docs/DocumentCard';
import WatermarkOverlay from '@/components/security/WatermarkOverlay';
import { useAuth } from '@/context/AuthContext';
import { Search, Filter, Shield, FolderOpen, FileType, ShieldOff, RefreshCw } from 'lucide-react';
import type { SecurityLabel } from '@/types/docs';

const LABELS: { value: SecurityLabel | ''; label: string }[] = [
  { value: '', label: 'All Labels' },
  { value: 'internal', label: 'Internal' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'confidential', label: 'Confidential' },
];

const DOC_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
];

function getDocType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

export default function DocsVaultPage() {
  const { user } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState<SecurityLabel | ''>('');
  const [project, setProject] = useState('');
  const [docType, setDocType] = useState('');

  const { folders } = useFolders();
  const { docs, loading, error, refetch } = useDocs(
    useMemo(
      () => ({
        folderId: selectedFolder ?? undefined,
        label: label || undefined,
        search: search || undefined,
      }),
      [selectedFolder, label, search]
    )
  );

  // Build project options from available folder names
  const projectOptions = useMemo(() => {
    const names = new Set(
      docs
        .map((d) => d.folder?.name)
        .filter((n): n is string => !!n)
    );
    return Array.from(names).sort();
  }, [docs]);

  // Client-side filter by project and doc type
  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      if (project && doc.folder?.name !== project) return false;
      if (docType && getDocType(doc.mimeType) !== docType) return false;
      return true;
    });
  }, [docs, project, docType]);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  const hasAnyAccess = isAdmin || filteredDocs.some((d) => !!d.access);

  // Detect if user has docs but ALL their access grants are expired
  const hasExpiredAccess = !isAdmin && docs.length > 0 && docs.every((d) => {
    if (!d.access) return false; // no grant = not expired, just no access
    const exp = d.access.expiresAt;
    return exp !== null && new Date(exp) < new Date();
  });

  const hasActiveFilters = !!(label || project || docType || search);

  return (
    <MainLayout title="Docs Vault">
      {hasAnyAccess && <WatermarkOverlay />}
      <div className="flex gap-6 h-full">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folders</span>
            </div>
            <FolderTree
              folders={folders}
              selectedId={selectedFolder}
              onSelect={setSelectedFolder}
            />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Expired access blocking banner */}
          {hasExpiredAccess && (
            <div className="flex items-start gap-3 bg-red-950/60 border border-red-800/60 rounded-xl px-4 py-3">
              <ShieldOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Your document access has expired</p>
                <p className="text-xs text-red-400/80 mt-0.5">
                  All of your access grants have expired. Open a document card to re-request access from an admin.
                </p>
              </div>
            </div>
          )}
          {/* Toolbar */}
          <div className="flex gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Security label filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={label}
                onChange={(e) => setLabel(e.target.value as SecurityLabel | '')}
                className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {LABELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Project filter */}
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 appearance-none"
              >
                <option value="">All Projects</option>
                {projectOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Document type filter */}
            <div className="relative">
              <FileType className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setLabel(''); setProject(''); setDocType(''); }}
                className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-900 border border-gray-700 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            {/* Refresh */}
            <button
              onClick={refetch}
              disabled={loading}
              title="Refresh documents"
              className="p-2 text-gray-400 hover:text-gray-200 bg-gray-900 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No documents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onAccessRequested={refetch} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
