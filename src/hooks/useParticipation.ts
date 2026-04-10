'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface Participation {
  id: string;
  userId: string;
  cycleId: string;
  optedIn: boolean;
  participationStatus: 'active' | 'at-risk' | 'paused' | 'grace';
  stallStage: 'none' | 'grace' | 'active' | 'at_risk' | 'diminishing' | 'paused';
  lastActivityDate: string | null;
  createdAt: string;
  cycle?: {
    id: string;
    name: string;
    state: string;
    startDate: string;
    endDate: string;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface UseParticipationResult {
  participation: Participation | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useParticipation(
  userId?: string,
  cycleId?: string
): UseParticipationResult {
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipation = useCallback(async () => {
    if (!userId || !cycleId) {
      setParticipation(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const participationData = await apiClient.getParticipation(cycleId);
      // apiClient unwraps { success: true, data: ... } automatically
      setParticipation(participationData ?? null);
    } catch (err) {
      // Treat any fetch failure as "no participation" — never crash the UI
      setParticipation(null);
      if (err instanceof Error && !err.message.includes('404') && !err.message.includes('not found')) {
        console.error('Error fetching participation:', err);
        setError(err.message);
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, cycleId]);

  useEffect(() => {
    fetchParticipation();
  }, [fetchParticipation]);

  return {
    participation,
    loading,
    error,
    refetch: fetchParticipation,
  };
}