'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ParticipationRecord {
  id: string;
  userId: string;
  cycleId: string;
  optedIn: boolean;
  participationStatus: 'active' | 'at-risk' | 'paused' | 'grace';
  stallStage: 'none' | 'grace' | 'active' | 'at_risk' | 'diminishing' | 'paused';
  lastActivityDate?: string;
  createdAt: string;
  cycle?: {
    id: string;
    name: string;
    state: string;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export function useParticipation(userId: string | undefined, cycleId: string) {
  const [participation, setParticipation] = useState<ParticipationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipation = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getParticipation(cycleId);
      setParticipation(data);
    } catch (err: any) {
      // If participation not found, that's okay - user hasn't joined yet
      if (err.message?.includes('not found')) {
        setParticipation(null);
      } else {
        setError(err.message || 'Failed to fetch participation');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipation();
  }, [userId, cycleId]);

  return {
    participation,
    loading,
    error,
    refetch: fetchParticipation,
  };
}
