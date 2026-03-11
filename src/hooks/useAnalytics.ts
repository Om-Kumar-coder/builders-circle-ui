'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface DashboardAnalytics {
  totalActivities: number;
  verifiedActivities: number;
  pendingActivities: number;
  rejectedActivities: number;
  participationHealth: {
    active: number;
    atRisk: number;
    diminishing: number;
    paused: number;
  };
  totalSubmissions: number;
  avgFrequency: number;
  inactiveUsers: number;
  totalUsers: number;
  activeUsers: number;
}

interface CycleAnalytics {
  cycleId: string;
  cycleName: string;
  participantCount: number;
  currentStage: string;
  lastActivityDate: string | null;
  progress: number;
  startDate: string;
  endDate: string;
  state: string;
}

export function useAnalytics(cycleId?: string, refreshInterval: number = 60000) {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const data = await apiClient.getDashboardAnalytics(cycleId);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();

    // Set up auto-refresh
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [cycleId, refreshInterval]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics
  };
}

export function useCycleAnalytics(cycleId: string, refreshInterval: number = 60000) {
  const [analytics, setAnalytics] = useState<CycleAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const data = await apiClient.getCycleAnalytics(cycleId);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cycle analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cycleId) {
      fetchAnalytics();

      // Set up auto-refresh
      const interval = setInterval(fetchAnalytics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [cycleId, refreshInterval]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics
  };
}