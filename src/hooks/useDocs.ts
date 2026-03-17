import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { DocFolder, DocumentMeta } from '@/types/docs';

export function useDocs(params?: { folderId?: string; label?: string; search?: string }) {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getDocs(params);
      setDocs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [params?.folderId, params?.label, params?.search]); // eslint-disable-line

  useEffect(() => { fetch(); }, [fetch]);

  return { docs, loading, error, refetch: fetch };
}

export function useFolders() {
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getFolders().then(setFolders).finally(() => setLoading(false));
  }, []);

  return { folders, loading };
}
