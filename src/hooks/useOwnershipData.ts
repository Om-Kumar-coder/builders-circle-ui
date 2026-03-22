'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface OwnershipData {
  vested: number;
  provisional: number;
  multiplier: number;
  effective: number;
  // Economy engine additions (optional — fallback to undefined when not yet computed)
  normalizedOwnershipPct?: number;
  contributionScore?: number;
  totalSystemScore?: number;
  contributorPoolPct?: number;
}

interface UseOwnershipDataResult {
  data: OwnershipData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOwnershipData(
  userId: string,
  cycleId: string,
  refreshInterval: number = 60000
): UseOwnershipDataResult {
  const [data, setData] = useState<OwnershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOwnership = useCallback(async () => {
    if (!userId || !cycleId) {
      console.log('⏭️ Skipping ownership fetch - missing userId or cycleId:', { userId, cycleId });
      setData({
        vested: 0,
        provisional: 0,
        multiplier: 1,
        effective: 0,
      });
      setLoading(false);
      return;
    }

    try {
      console.log('📊 Fetching ownership data:', { userId, cycleId });
      setLoading(true);
      setError(null);

      // Fetch both existing and normalized data in parallel; normalized is best-effort
      const [result, normalizedResult] = await Promise.allSettled([
        apiClient.getOwnership(userId, cycleId),
        apiClient.getNormalizedOwnership(userId, cycleId),
      ]);

      console.log('✅ Ownership data received:', result);

      const base = result.status === 'fulfilled' ? result.value : null;
      const normalized = normalizedResult.status === 'fulfilled' ? normalizedResult.value : null;

      setData({
        vested: base?.vestedOwnership ?? 0,
        provisional: base?.provisionalOwnership ?? 0,
        multiplier: base?.multiplier ?? 1,
        effective: base?.effectiveOwnership ?? 0,
        // Economy engine fields — undefined when not yet available (safe fallback)
        normalizedOwnershipPct: normalized?.normalizedOwnershipPct,
        contributionScore: normalized?.contributionScore,
        totalSystemScore: normalized?.totalSystemScore,
        contributorPoolPct: normalized?.contributorPoolPct,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Error fetching ownership data:', err);
      setError(errorMessage);
      setData({
        vested: 0,
        provisional: 0,
        multiplier: 1,
        effective: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, cycleId]);

  useEffect(() => {
    fetchOwnership();
    const interval = setInterval(fetchOwnership, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchOwnership, refreshInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchOwnership,
  };
}
