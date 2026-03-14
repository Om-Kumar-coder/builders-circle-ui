'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  Calendar,
  Target,
  BarChart3,
  RefreshCw
} from 'lucide-react';

interface CycleOverview {
  cycle: {
    id: string;
    name: string;
    description: string;
    state: string;
    startDate: string;
    endDate: string;
    participantCount: number;
  };
  participants: Array<{
    id: string;
    email: string;
    name: string;
    stallStage: string;
    participationStatus: string;
    lastActivityDate: string | null;
    verifiedActivities: number;
    totalHours: number;
  }>;
  analytics: {
    totalActivities: number;
    verifiedActivities: number;
    pendingActivities: number;
    totalHours: number;
    averageHoursPerUser: number;
    engagementScore: number;
    messageCount: number;
  };
  ownershipDistribution: Array<{
    userId: string;
    userName: string;
    totalOwnership: number;
    vestedOwnership: number;
    percentage: number;
  }>;
}

export default function CycleOverviewPage() {
  const params = useParams();
  const cycleId = (Array.isArray(params.id) ? params.id[0] : params.id) as string;
  const { loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<CycleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cycle = await apiClient.getCycle(cycleId);
      const participants = await apiClient.getTeamMembers(cycleId);
      const analytics = await apiClient.getCycleAnalytics(cycleId);
      const engagement = await apiClient.getCycleEngagement(cycleId);

      const ownershipDistribution = participants.map((p: { id: string; name?: string; email: string }, _index: number) => ({
        userId: p.id,
        userName: p.name || p.email,
        totalOwnership: Math.random() * 10,
        vestedOwnership: Math.random() * 5,
        percentage: Math.random() * 20
      })).sort((a: { totalOwnership: number }, b: { totalOwnership: number }) => b.totalOwnership - a.totalOwnership);

      setOverview({
        cycle,
        participants,
        analytics: {
          totalActivities: analytics.totalActivities ?? 0,
          verifiedActivities: analytics.verifiedActivities ?? 0,
          pendingActivities: analytics.pendingActivities ?? 0,
          totalHours: analytics.totalHours ?? 0,
          averageHoursPerUser: analytics.averageHoursPerUser ?? 0,
          engagementScore: engagement?.engagementScore ?? 0,
          messageCount: engagement?.messageCount ?? 0,
        },
        ownershipDistribution
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cycle overview');
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    if (cycleId) {
      fetchOverview();
    }
  }, [cycleId, fetchOverview]);

  const getStallStageColor = (stage: string) => {
    switch (stage) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'grace': return 'bg-blue-500/20 text-blue-400';
      case 'at_risk': return 'bg-yellow-500/20 text-yellow-400';
      case 'diminishing': return 'bg-orange-500/20 text-orange-400';
      case 'paused': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getCycleStateColor = (state: string) => {
    switch (state) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'planned': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (authLoading || loading) return <LoadingScreen />;

  if (error || !overview) {
    return (
      <MainLayout title="Cycle Overview">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">{error || 'Cycle not found'}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const { cycle, participants, analytics } = overview;

  const participationBreakdown = {
    active: participants.filter(p => p.stallStage === 'active').length,
    at_risk: participants.filter(p => p.stallStage === 'at_risk').length,
    diminishing: participants.filter(p => p.stallStage === 'diminishing').length,
    paused: participants.filter(p => p.stallStage === 'paused').length,
    grace: participants.filter(p => p.stallStage === 'grace').length,
  };

  return (
    <MainLayout title={`${cycle.name} - Overview`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Target className="w-8 h-8 text-indigo-500" />
              {cycle.name}
            </h1>
            <p className="text-gray-400 mt-1">{cycle.description}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getCycleStateColor(cycle.state)}`}>
                {cycle.state}
              </span>
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(cycle.startDate).toLocaleDateString()} - {new Date(cycle.endDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Participants</p>
                <p className="text-2xl font-bold text-gray-100">{cycle.participantCount}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Activities</p>
                <p className="text-2xl font-bold text-gray-100">{analytics.totalActivities}</p>
              </div>
              <Activity className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Engagement Score</p>
                <p className="text-2xl font-bold text-gray-100">{(analytics.engagementScore ?? 0).toFixed(1)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Hours</p>
                <p className="text-2xl font-bold text-gray-100">{(analytics.totalHours ?? 0).toFixed(1)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Participation Status
            </h3>
            <div className="space-y-3">
              {Object.entries(participationBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      status === 'active' ? 'bg-green-500' :
                      status === 'grace' ? 'bg-blue-500' :
                      status === 'at_risk' ? 'bg-yellow-500' :
                      status === 'diminishing' ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm text-gray-300 capitalize">{status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{count}</span>
                    <span className="text-xs text-gray-500">
                      ({participants.length > 0 ? Math.round((count / participants.length) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Activity Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Verified Activities</span>
                <span className="text-sm font-medium text-green-400">{analytics.verifiedActivities}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Pending Review</span>
                <span className="text-sm font-medium text-yellow-400">{analytics.pendingActivities}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Avg Hours/User</span>
                <span className="text-sm font-medium text-gray-100">{(analytics.averageHoursPerUser ?? 0).toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Messages</span>
                <span className="text-sm font-medium text-blue-400">{analytics.messageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Verification Rate</span>
                <span className="text-sm font-medium text-indigo-400">
                  {analytics.totalActivities > 0 ? Math.round((analytics.verifiedActivities / analytics.totalActivities) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Participants ({participants.length})
          </h3>
          <div className="space-y-3">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-100">{participant.name || 'Unnamed User'}</p>
                    <p className="text-xs text-gray-400">{participant.email}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStallStageColor(participant.stallStage)}`}>
                    {participant.stallStage}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-medium text-gray-100">{participant.verifiedActivities}</p>
                    <p className="text-xs text-gray-400">activities</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-100">{(participant.totalHours ?? 0).toFixed(1)}</p>
                    <p className="text-xs text-gray-400">hours</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-100">
                      {participant.lastActivityDate ? new Date(participant.lastActivityDate).toLocaleDateString() : 'Never'}
                    </p>
                    <p className="text-xs text-gray-400">last activity</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
