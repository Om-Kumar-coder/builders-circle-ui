'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { BuildCycle } from '@/types/cycle';

export function useCycles() {
  const [cycles, setCycles] = useState<BuildCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = async () => {
    try {
      console.log('📋 Fetching cycles...');
      setLoading(true);
      setError(null);
      
      const data = await apiClient.getCycles();

      console.log('✅ Cycles fetched:', { count: data.length });

      // Sort: active cycles first, then by start date
      const sorted = data.sort((a: BuildCycle, b: BuildCycle) => {
        const stateOrder = { active: 0, paused: 1, planned: 2, closed: 3 };
        if (stateOrder[a.state] !== stateOrder[b.state]) {
          return stateOrder[a.state] - stateOrder[b.state];
        }
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      setCycles(sorted);
    } catch (err: any) {
      console.error('❌ Error fetching cycles:', err);
      
      // Handle rate limiting gracefully
      if (err.status === 429) {
        setError('Too many requests. Please wait a moment before refreshing.');
      } else {
        setError(err.message || 'Failed to fetch cycles');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  return { cycles, loading, error, refetch: fetchCycles };
}
