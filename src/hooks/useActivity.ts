'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserCycleActivity, getLastActivity, type ActivityEvent } from '@/lib/activity';

interface UseActivityResult {
  activities: ActivityEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user activities for a specific cycle
 */
export function useActivity(userId: string, cycleId: string): UseActivityResult {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserCycleActivity(userId, cycleId);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  }, [userId, cycleId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
  };
}

interface UseLastActivityResult {
  lastActivity: ActivityEvent | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the last activity for a user
 */
export function useLastActivity(userId: string): UseLastActivityResult {
  const [lastActivity, setLastActivity] = useState<ActivityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLastActivity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLastActivity(userId);
      setLastActivity(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch last activity');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLastActivity();
  }, [fetchLastActivity]);

  return {
    lastActivity,
    loading,
    error,
    refetch: fetchLastActivity,
  };
}
