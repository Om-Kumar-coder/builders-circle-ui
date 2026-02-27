'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { databases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { TrendingUp, Users, Activity, AlertCircle, BarChart3, PieChart, RefreshCw } from 'lucide-react';
import { BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface InsightsData {
  participationHealth: {
    active: number;
    atRisk: number;
    diminishing: number;
    paused: number;
    total: number;
  };
  activityInsights: {
    totalSubmissions: number;
    averageFrequency: number;
    inactiveParticipants: number;
  };
  cycleInsights: {
    participationRate: number;
    engagementScore: number;
  };
}

const COLORS = {
  active: '#10b981',
  atRisk: '#f59e0b',
  diminishing: '#f97316',
  paused: '#ef4444',
};

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cycleId = 'cycle456'; // TODO: Get from context

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch participation data
      const participationResponse = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID || 'cycle_participation',
        [
          Query.equal('cycleId', cycleId),
          Query.equal('optedIn', true),
          Query.limit(1000)
        ]
      );

      const participants = participationResponse.documents;

      // Calculate participation health
      const participationHealth = {
        active: participants.filter(p => p.stallStage === 'active' || p.stallStage === 'none').length,
        atRisk: participants.filter(p => p.stallStage === 'at_risk').length,
        diminishing: participants.filter(p => p.stallStage === 'diminishing').length,
        paused: participants.filter(p => p.stallStage === 'paused').length,
        total: participants.length,
      };

      // Fetch activity data
      const activityResponse = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID || 'activity_events',
        [
          Query.equal('cycleId', cycleId),
          Query.limit(1000)
        ]
      );

      const activities = activityResponse.documents;

      // Calculate activity insights
      const activityInsights = {
        totalSubmissions: activities.length,
        averageFrequency: participants.length > 0 ? activities.length / participants.length : 0,
        inactiveParticipants: participants.filter(p => 
          p.stallStage === 'paused' || p.stallStage === 'diminishing'
        ).length,
      };

      // Calculate cycle insights
      const cycleInsights = {
        participationRate: participants.length > 0 ? (participationHealth.active / participants.length) * 100 : 0,
        engagementScore: participants.length > 0 
          ? ((participationHealth.active * 100 + participationHealth.atRisk * 75 + participationHealth.diminishing * 50) / participants.length)
          : 0,
      };

      setData({
        participationHealth,
        activityInsights,
        cycleInsights,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user, cycleId]);

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
  const stallStageData = data ? [
    { name: 'Active', value: data.participationHealth.active, color: COLORS.active },
    { name: 'At Risk', value: data.participationHealth.atRisk, color: COLORS.atRisk },
    { name: 'Diminishing', value: data.participationHealth.diminishing, color: COLORS.diminishing },
    { name: 'Paused', value: data.participationHealth.paused, color: COLORS.paused },
  ] : [];

  const activityTrendData = data ? [
    { name: 'Total', value: data.activityInsights.totalSubmissions },
    { name: 'Avg/User', value: Math.round(data.activityInsights.averageFrequency * 10) / 10 },
    { name: 'Inactive', value: data.activityInsights.inactiveParticipants },
  ] : [];

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
            onClick={fetchInsights}
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
        ) : data ? (
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
                  <p className="text-2xl font-bold text-green-400">{data.participationHealth.active}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.participationHealth.total > 0 
                      ? Math.round((data.participationHealth.active / data.participationHealth.total) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">At Risk</p>
                  <p className="text-2xl font-bold text-yellow-400">{data.participationHealth.atRisk}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.participationHealth.total > 0 
                      ? Math.round((data.participationHealth.atRisk / data.participationHealth.total) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Diminishing</p>
                  <p className="text-2xl font-bold text-orange-400">{data.participationHealth.diminishing}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.participationHealth.total > 0 
                      ? Math.round((data.participationHealth.diminishing / data.participationHealth.total) * 100)
                      : 0}% of total
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Paused</p>
                  <p className="text-2xl font-bold text-red-400">{data.participationHealth.paused}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.participationHealth.total > 0 
                      ? Math.round((data.participationHealth.paused / data.participationHealth.total) * 100)
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
                  <p className="text-2xl font-bold text-gray-100">{data.activityInsights.totalSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Avg Frequency</p>
                  <p className="text-2xl font-bold text-gray-100">
                    {data.activityInsights.averageFrequency.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Activities per user</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Inactive Users</p>
                  <p className="text-2xl font-bold text-gray-100">{data.activityInsights.inactiveParticipants}</p>
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
                    {data.cycleInsights.participationRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Active participants</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm text-gray-400 mb-1">Engagement Score</p>
                  <p className="text-2xl font-bold text-indigo-400">
                    {data.cycleInsights.engagementScore.toFixed(1)}
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
