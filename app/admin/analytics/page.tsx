'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../src/context/AuthContext';
import { useCycle } from '../../../src/context/CycleContext';
import MainLayout from '../../../src/components/layout/MainLayout';
import { apiClient } from '../../../src/lib/api-client';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface AnalyticsData {
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

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const { activeCycle, allCycles } = useCycle();
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeCycle && !selectedCycleId) {
      setSelectedCycleId(activeCycle.id);
    }
  }, [activeCycle, selectedCycleId]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getDashboardAnalytics(selectedCycleId || undefined);
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (!user || !user.role || !['admin', 'founder'].includes(user.role)) {
    return (
      <MainLayout title="Access Denied">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-400">You don&apos;t have permission to view this page.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Analytics & Insights">
      <div className="space-y-6">
        {/* Header with Cycle Selector */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Analytics & Insights</h1>
            <p className="text-gray-400 mt-1">Participation health and behavior insights</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-300"
            >
              <option value="">All Cycles</option>
              {allCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </select>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loading && !analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : analytics ? (
          <>
            {/* Participation Health */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Participation Health</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="text-3xl font-bold text-green-400 mb-1">{analytics.participationHealth.active}</div>
                  <div className="text-sm text-gray-400 mb-1">Active</div>
                  <div className="text-xs text-gray-500">
                    {analytics.totalUsers > 0 ? Math.round((analytics.participationHealth.active / analytics.totalUsers) * 100) : 0}% of total
                  </div>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-400 mb-1">{analytics.participationHealth.atRisk}</div>
                  <div className="text-sm text-gray-400 mb-1">At Risk</div>
                  <div className="text-xs text-gray-500">
                    {analytics.totalUsers > 0 ? Math.round((analytics.participationHealth.atRisk / analytics.totalUsers) * 100) : 0}% of total
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="text-3xl font-bold text-orange-400 mb-1">{analytics.participationHealth.diminishing}</div>
                  <div className="text-sm text-gray-400 mb-1">Diminishing</div>
                  <div className="text-xs text-gray-500">
                    {analytics.totalUsers > 0 ? Math.round((analytics.participationHealth.diminishing / analytics.totalUsers) * 100) : 0}% of total
                  </div>
                </div>
                <div className="text-center p-4 bg-gray-500/10 border border-gray-500/30 rounded-lg">
                  <div className="text-3xl font-bold text-gray-400 mb-1">{analytics.participationHealth.paused}</div>
                  <div className="text-sm text-gray-400 mb-1">Paused</div>
                  <div className="text-xs text-gray-500">
                    {analytics.totalUsers > 0 ? Math.round((analytics.participationHealth.paused / analytics.totalUsers) * 100) : 0}% of total
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Insights */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Activity Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-indigo-400">{analytics.totalSubmissions}</div>
                  <div className="text-sm text-gray-400">Total Submissions</div>
                  <div className="text-xs text-gray-500">All time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{analytics.avgFrequency.toFixed(1)}</div>
                  <div className="text-sm text-gray-400">Avg Frequency</div>
                  <div className="text-xs text-gray-500">Activities per user</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400">{analytics.inactiveUsers}</div>
                  <div className="text-sm text-gray-400">Inactive Users</div>
                  <div className="text-xs text-gray-500">Need attention</div>
                </div>
              </div>
            </div>

            {/* Cycle Performance */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Cycle Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {analytics.totalUsers > 0 ? ((analytics.activeUsers / analytics.totalUsers) * 100).toFixed(1) : 0.0}%
                  </div>
                  <div className="text-sm text-gray-400">Participation Rate</div>
                  <div className="text-xs text-gray-500">Active participants</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">
                    {analytics.totalActivities > 0 ? ((analytics.verifiedActivities / analytics.totalActivities) * 100).toFixed(1) : 0.0}
                  </div>
                  <div className="text-sm text-gray-400">Engagement Score</div>
                  <div className="text-xs text-gray-500">Weighted average</div>
                </div>
              </div>
            </div>

            {/* Activity Status Breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Activity Status Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{analytics.verifiedActivities}</div>
                  <div className="text-sm text-gray-400">Verified</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{analytics.pendingActivities}</div>
                  <div className="text-sm text-gray-400">Pending</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">{analytics.rejectedActivities}</div>
                  <div className="text-sm text-gray-400">Rejected</div>
                </div>
                <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-400">{analytics.totalActivities}</div>
                  <div className="text-sm text-gray-400">Total</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}