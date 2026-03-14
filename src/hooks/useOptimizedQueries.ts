import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry.data as T;
  }
  return null;
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  enabled = true,
  refetchIntervalMs?: number
): QueryResult<T> {
  const [data, setData] = useState<T | null>(() => getCached<T>(key, ttlMs));
  const [loading, setLoading] = useState(!getCached<T>(key, ttlMs) && enabled);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    const cached = getCached<T>(key, ttlMs);
    if (cached) { setData(cached); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setCached(key, result);
      setData(result);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [key, ttlMs, fetcher, enabled]);

  useEffect(() => {
    fetch();
    if (refetchIntervalMs) {
      intervalRef.current = setInterval(fetch, refetchIntervalMs);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch, refetchIntervalMs]);

  return { data, loading, error, refetch: fetch };
}

// QUERY KEYS
export const queryKeys = {
  engagement: (cycleId: string) => `engagement:${cycleId}`,
  contributors: (limit: number) => `contributors:${limit}`,
  notifications: () => 'notifications',
  unreadCount: () => 'notifications:unread',
  dashboardAnalytics: (cycleId?: string) => `analytics:dashboard:${cycleId ?? ''}`,
  activities: (cycleId?: string, userId?: string) => `activities:${cycleId ?? ''}:${userId ?? ''}`,
  participation: (cycleId: string) => `participation:${cycleId}`,
  ownership: (userId: string, cycleId: string) => `ownership:${userId}:${cycleId}`,
  cycles: () => 'cycles',
  cycle: (cycleId: string) => `cycle:${cycleId}`,
};

export function useEngagement(cycleId: string) {
  return useQuery(
    queryKeys.engagement(cycleId),
    () => apiClient.getCycleAnalytics(cycleId),
    5 * 60 * 1000,
    !!cycleId
  );
}

export function useTopContributors(limit = 10) {
  return useQuery(
    queryKeys.contributors(limit),
    () => apiClient.getDashboardAnalytics(),
    10 * 60 * 1000,
    limit > 0
  );
}

export function useNotifications() {
  return useQuery(
    queryKeys.notifications(),
    () => apiClient.getNotifications(),
    30 * 1000,
    true,
    60 * 1000
  );
}

export function useDashboardAnalytics(cycleId?: string) {
  return useQuery(
    queryKeys.dashboardAnalytics(cycleId),
    () => apiClient.getDashboardAnalytics(cycleId),
    2 * 60 * 1000,
    true,
    5 * 60 * 1000
  );
}

export function useActivities(cycleId?: string, userId?: string) {
  return useQuery(
    queryKeys.activities(cycleId, userId),
    () => apiClient.getActivities({ cycleId, userId }),
    60 * 1000,
    !!(cycleId || userId)
  );
}

export function useParticipation(cycleId: string) {
  return useQuery(
    queryKeys.participation(cycleId),
    () => apiClient.getParticipation(cycleId),
    2 * 60 * 1000,
    !!cycleId
  );
}

export function useOwnership(userId: string, cycleId: string) {
  return useQuery(
    queryKeys.ownership(userId, cycleId),
    () => apiClient.getOwnership(userId, cycleId),
    60 * 1000,
    !!(userId && cycleId)
  );
}

export function useCycles() {
  return useQuery(queryKeys.cycles(), () => apiClient.getCycles(), 5 * 60 * 1000);
}

export function useCycle(cycleId: string) {
  return useQuery(
    queryKeys.cycle(cycleId),
    () => apiClient.getCycle(cycleId),
    2 * 60 * 1000,
    !!cycleId
  );
}

export function useAdminStats() {
  return useQuery(
    'admin:stats',
    () => apiClient.getDashboardAnalytics(),
    60 * 1000,
    true,
    2 * 60 * 1000
  );
}

// Cache invalidation helpers
export function useCacheInvalidation() {
  const invalidateActivities = useCallback(() => {
    invalidateCache('activities');
    invalidateCache('analytics');
    invalidateCache('participation');
  }, []);

  const invalidateOwnership = useCallback(() => {
    invalidateCache('ownership');
    invalidateCache('analytics');
  }, []);

  const invalidateNotifications = useCallback(() => {
    invalidateCache('notifications');
  }, []);

  const invalidateAll = useCallback(() => {
    cache.clear();
  }, []);

  return { invalidateActivities, invalidateOwnership, invalidateNotifications, invalidateAll };
}
