'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useDocs, useFolders } from '@/hooks/useDocs';
import FolderTree from '@/components/docs/FolderTree';
import DocumentCard from '@/components/docs/DocumentCard';
import WatermarkOverlay from '@/components/security/WatermarkOverlay';
import { useAuth } from '@/context/AuthContext';
import { Search, Filter, Shield } from 'lucide-react';
import type { SecurityLabel } from '@/types/docs';

const LABELS: { value: SecurityLabel | ''; label: string }[] = [
  { value: '', label: 'All Labels' },
  { value: 'internal', label: 'Internal' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'confidential', label: 'Confidential' },
];

export default function DocsVaultPage() {
  const { user } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState<SecurityLabel | ''>('');

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

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  // Show watermark if user has access to any doc (or is admin)
  const hasAnyAccess = isAdmin || docs.some((d) => !!d.access);

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
          {/* Toolbar */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
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
          ) : docs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No documents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onAccessRequested={refetch} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
