'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ParticipationLeave } from '@/types/task';

export function useLeaveStatus(cycleId: string) {
  const [onLeave, setOnLeave] = useState(false);
  const [leave, setLeave] = useState<ParticipationLeave | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!cycleId) return;
    try {
      setLoading(true);
      const data = await apiClient.getLeaveStatus(cycleId);
      setOnLeave(data.onLeave);
      setLeave(data.leave);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { onLeave, leave, loading, refetch: fetch };
}

export function useMyLeaves() {
  const [leaves, setLeaves] = useState<ParticipationLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMyLeaves();
      setLeaves(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { leaves, loading, refetch: fetch };
}
