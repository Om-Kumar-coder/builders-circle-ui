'use client';

import { useState, useEffect } from 'react';
import { databases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { BuildCycle } from '@/types/cycle';

export function useCycles() {
  const [cycles, setCycles] = useState<BuildCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID || '',
        [Query.orderDesc('$createdAt')]
      );

      // Sort: active cycles first, then by start date
      const sorted = (response.documents as BuildCycle[]).sort((a, b) => {
        const stateOrder = { active: 0, paused: 1, planned: 2, closed: 3 };
        if (stateOrder[a.state] !== stateOrder[b.state]) {
          return stateOrder[a.state] - stateOrder[b.state];
        }
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      setCycles(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  return { cycles, loading, error, refetch: fetchCycles };
}
