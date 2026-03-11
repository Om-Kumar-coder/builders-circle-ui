'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface OwnershipData {
  vested: number;
  provisional: number;
  multiplier: number;
  effective: number;
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
      setData(null);
      setLoading(false);
      return;
    }

    try {
      console.log('📊 Fetching ownership data:', { userId, cycleId });
      setLoading(true);
      setError(null);

      const result = await apiClient.getOwnership(userId, cycleId);

      console.log('✅ Ownership data received:', result);

      // The API client now returns the data directly (after extracting from standardized response)
      setData({
        vested: result.vestedOwnership || 0,
        provisional: result.provisionalOwnership || 0,
        multiplier: result.multiplier || 1,
        effective: result.effectiveOwnership || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Error fetching ownership data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, cycleId]);

  useEffect(() => {
    fetchOwnership();

    // Set up auto-refresh
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
