'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EngagementScoreProps {
  cycleId?: string;
}

interface EngagementData {
  score: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  breakdown: {
    activityFrequency: number;
    participationRate: number;
    verificationRate: number;
    consistencyScore: number;
  };
  totalParticipants: number;
  activeParticipants: number;
}

export default function EngagementScore({ cycleId }: EngagementScoreProps) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEngagementData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get analytics data
        const analytics = await apiClient.getDashboardAnalytics(cycleId);
        
        // Calculate engagement score based on various metrics
        const activityFrequency = Math.min(100, (analytics.avgFrequency || 0) * 20); // Scale to 0-100
        const participationRate = analytics.totalUsers > 0 
          ? (analytics.activeUsers / analytics.totalUsers) * 100 
          : 0;
        const verificationRate = analytics.totalActivities > 0 
          ? (analytics.verifiedActivities / analytics.totalActivities) * 100 
          : 0;
        
        // Mock consistency score (would be calculated from historical data)
        const consistencyScore = 75; // This would come from analyzing activity patterns
        
        // Calculate overall engagement score (weighted average)
        const score = Math.round(
          (activityFrequency * 0.3) +
          (participationRate * 0.3) +
          (verificationRate * 0.2) +
          (consistencyScore * 0.2)
        );
        
        // Derive trend from participation rate: >70% = up, <40% = down, else stable
        const trendValue = participationRate > 70 ? participationRate - 70 : participationRate < 40 ? 40 - participationRate : 0;
        const trend: 'up' | 'down' | 'stable' = participationRate > 70 ? 'up' : participationRate < 40 ? 'down' : 'stable';
        
        setData({
          score,
          trend,
          trendValue: trendValue,
          breakdown: {
            activityFrequency: Math.round(activityFrequency),
            participationRate: Math.round(participationRate),
            verificationRate: Math.round(verificationRate),
            consistencyScore
          },
          totalParticipants: analytics.totalUsers || 0,
          activeParticipants: analytics.activeUsers || 0
        });
      } catch (err) {
        console.error('Error fetching engagement data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load engagement data');
      } finally {
        setLoading(false);
      }
    };

    fetchEngagementData();
  }, [cycleId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-500/20 to-emerald-500/20';
    if (score >= 60) return 'from-yellow-500/20 to-amber-500/20';
    if (score >= 40) return 'from-orange-500/20 to-red-500/20';
    return 'from-red-500/20 to-rose-500/20';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 bg-gray-800 rounded"></div>
            <div className="h-6 bg-gray-800 rounded w-32"></div>
          </div>
          <div className="h-16 bg-gray-800 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-800 rounded"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Engagement Score</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-center py-8">
          <p className="text-gray-400">No engagement data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br ${getScoreGradient(data.score)} border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Engagement Score</h3>
        </div>
        <div className="flex items-center gap-1">
          {getTrendIcon(data.trend)}
          <span className={`text-sm font-medium ${getTrendColor(data.trend)}`}>
            {data.trend === 'stable' ? 'Stable' : `${data.trendValue.toFixed(1)}%`}
          </span>
        </div>
      </div>

      {/* Main Score */}
      <div className="text-center mb-6">
        <div className={`text-5xl font-bold ${getScoreColor(data.score)} mb-2`}>
          {data.score}
        </div>
        <p className="text-sm text-gray-400">Overall Engagement</p>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Activity Frequency</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${data.breakdown.activityFrequency}%` }}
              />
            </div>
            <span className="text-sm text-gray-300 w-8 text-right">
              {data.breakdown.activityFrequency}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Participation Rate</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${data.breakdown.participationRate}%` }}
              />
            </div>
            <span className="text-sm text-gray-300 w-8 text-right">
              {data.breakdown.participationRate}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Verification Rate</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${data.breakdown.verificationRate}%` }}
              />
            </div>
            <span className="text-sm text-gray-300 w-8 text-right">
              {data.breakdown.verificationRate}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Consistency</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${data.breakdown.consistencyScore}%` }}
              />
            </div>
            <span className="text-sm text-gray-300 w-8 text-right">
              {data.breakdown.consistencyScore}
            </span>
          </div>
        </div>
      </div>

      {/* Participation Stats */}
      <div className="pt-4 border-t border-gray-800">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-100">{data.activeParticipants}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-100">{data.totalParticipants}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}