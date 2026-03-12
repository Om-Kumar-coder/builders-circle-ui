'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { ActivityEvent } from '@/types/activity';

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
    if (!userId || !cycleId) {
      console.log('⏭️ Skipping activity fetch - missing userId or cycleId:', { userId, cycleId });
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      console.log('📋 Fetching activities:', { userId, cycleId });
      setLoading(true);
      setError(null);
      
      const data = await apiClient.getActivities({ userId, cycleId });
      
      console.log('✅ Activities fetched:', { count: data.length });
      setActivities(data);
    } catch (err: any) {
      console.error('❌ Error fetching activities:', err);
      
      // Handle rate limiting gracefully
      if (err.status === 429) {
        setError('Too many requests. Please wait a moment before refreshing.');
      } else {
        setError(err.message || 'Failed to fetch activities');
      }
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
      const activities = await apiClient.getActivities({ userId });
      const sortedActivities = activities.sort((a: ActivityEvent, b: ActivityEvent) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setLastActivity(sortedActivities[0] || null);
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
