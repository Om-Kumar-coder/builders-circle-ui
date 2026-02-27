'use client';

import { useState, useEffect } from 'react';
import { getParticipation, type ParticipationRecord } from '@/lib/participation';

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
      const data = await getParticipation(userId, cycleId);
      setParticipation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch participation');
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
