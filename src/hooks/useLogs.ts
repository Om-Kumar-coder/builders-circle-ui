'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { FilterState } from './useFilters';

export interface LogEntry {
  id: string;
  logType: 'ownership' | 'admin' | 'security' | 'participation';
  createdAt?: string;
  timestamp?: string;
  eventType?: string;
  event?: string;
  action?: string;
  ownershipAmount?: number;
  multiplierSnapshot?: number;
  reason?: string;
  metadata?: string;
  [key: string]: unknown;
}

interface UseLogsResult {
  logs: LogEntry[];
  byType: Record<string, LogEntry[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLogs(filters: Partial<FilterState> = {}): UseLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [byType, setByType] = useState<Record<string, LogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getLogs(filters);
      setLogs(result?.logs ?? []);
      setByType(result?.byType ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, byType, loading, error, refetch: fetchLogs };
}
