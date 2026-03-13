'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCycle } from '@/context/CycleContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { TrendingUp, Users, Activity, AlertCircle, BarChart3, PieChart, RefreshCw } from 'lucide-react';
import { BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  active: '#10b981',
  atRisk: '#f59e0b',
  diminishing: '#f97316',
  paused: '#ef4444',
};

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeCycle } = useCycle();
  // Get active cycle ID from context - only proceed if we have a real cycle
  const cycleId = activeCycle?.id || '';
  
  const { analytics, loading, error, refetch } = useAnalytics(cycleId);

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Insights">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view insights.</p>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Insights">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <p className="text-gray-400">Admin access required to view insights.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Prepare chart data
  const stallStageData = analytics ? [
    { name: 'Active', value: analytics.participationHealth.active, color: COLORS.active },
    { name: 'At Risk', value: analytics.participationHealth.atRisk, color: COLORS.atRisk },
    { name: 'Diminishing', value: analytics.participationHealth.diminishing, color: COLORS.diminishing },
    { name: 'Paused', value: analytics.participationHealth.paused, color: COLORS.paused },
  ] : [];

  const activityTrendData = analytics ? [
    { name: 'Total', value: analytics.totalSubmissions },
    { name: 'Avg/User', value: Math.round(analytics.avgFrequency * 10) / 10 },
    { name: 'Inactive', value: analytics.inactiveUsers },
  ] : [];

  const totalParticipants = analytics ? 
    analytics.participationHealth.active + 
    analytics.participationHealth.atRisk + 
    analytics.participationHealth.diminishing + 
    analytics.participationHealth.paused : 0;

  return (
    <MainLayout title="Insights">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Analytics & Insights</h1>
            <p className="text-gray-400 mt-1">Participation health and behavior insights</p>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-800 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : analytics ? (
          <>
            {/* Participation Health Cards */}
            <div>
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Participation Health
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Active</p>
                  <p className="text-2xl font-bold text-green-400">{analytics.participationHealth.active}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalParticipants > 0 
                      ? Math.round((analytics.participationHealth.active / totalParticipants) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">At Risk</p>
                  <p className="text-2xl font-bold text-yellow-400">{analytics.participationHealth.atRisk}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalParticipants > 0 
                      ? Math.round((analytics.participationHealth.atRisk / totalParticipants) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Diminishing</p>
                  <p className="text-2xl font-bold text-orange-400">{analytics.participationHealth.diminishing}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalParticipants > 0 
                      ? Math.round((analytics.participationHealth.diminishing / totalParticipants) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Paused</p>
                  <p className="text-2xl font-bold text-red-400">{analytics.participationHealth.paused}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalParticipants > 0 
                      ? Math.round((analytics.participationHealth.paused / totalParticipants) * 100)
                      : 0}% of total
                  </p>
                </div>
              </div>
            </div>

            {/* Activity Insights */}
            <div>
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Activity Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Total Submissions</p>
                  <p className="text-2xl font-bold text-gray-100">{analytics.totalSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Avg Frequency</p>
                  <p className="text-2xl font-bold text-gray-100">
                    {analytics.avgFrequency.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Activities per user</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Inactive Users</p>
                  <p className="text-2xl font-bold text-gray-100">{analytics.inactiveUsers}</p>
                  <p className="text-xs text-gray-500 mt-1">Need attention</p>
                </div>
              </div>
            </div>

            {/* Cycle Insights */}
            <div>
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Cycle Performance
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Participation Rate</p>
                  <p className="text-2xl font-bold text-indigo-400">
                    {totalParticipants > 0 
                      ? ((analytics.participationHealth.active / totalParticipants) * 100).toFixed(1)
                      : '0.0'}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Active participants</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Engagement Score</p>
                  <p className="text-2xl font-bold text-indigo-400">
                    {totalParticipants > 0 
                      ? (((analytics.participationHealth.active * 100 + 
                           analytics.participationHealth.atRisk * 75 + 
                           analytics.participationHealth.diminishing * 50) / totalParticipants)).toFixed(1)
                      : '0.0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Weighted average</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stall Stage Distribution */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-400" />
                  Stall Stage Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={stallStageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stallStageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '0.5rem',
                        color: '#e5e7eb'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>

              {/* Activity Metrics */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  Activity Metrics
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={activityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '0.5rem',
                        color: '#e5e7eb'
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
