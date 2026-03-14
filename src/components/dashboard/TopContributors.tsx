'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Trophy, Star, TrendingUp } from 'lucide-react';

interface TopContributorsProps {
  limit?: number;
}

interface Contributor {
  id: string;
  name: string;
  email: string;
  reputationScore: number;
  verifiedActivities: number;
  totalHoursLogged: number;
  consistencyScore: number;
  rank: number;
}

export default function TopContributors({ limit = 5 }: TopContributorsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopContributors = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await apiClient.getTopContributors(limit);
        
        // Map API response to Contributor shape with rank
        const mapped: Contributor[] = (data || []).map((item: { userId?: string; id?: string; user?: { name?: string; email?: string }; name?: string; email?: string; reputationScore?: number; verifiedActivities?: number; totalHoursLogged?: number; consistencyScore?: number }, index: number) => ({
          id: item.userId || item.id || String(index),
          name: item.user?.name || item.name || 'Unknown',
          email: item.user?.email || item.email || '',
          reputationScore: item.reputationScore ?? 0,
          verifiedActivities: item.verifiedActivities ?? 0,
          totalHoursLogged: item.totalHoursLogged ?? 0,
          consistencyScore: item.consistencyScore ?? 0,
          rank: index + 1,
        }));
        
        setContributors(mapped);
      } catch (err) {
        console.error('Error fetching top contributors:', err);
        setError(err instanceof Error ? err.message : 'Failed to load top contributors');
      } finally {
        setLoading(false);
      }
    };

    fetchTopContributors();
  }, [limit]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Trophy className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Trophy className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-5 h-5 text-gray-500" />;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 2:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      case 3:
        return 'text-amber-600 bg-amber-500/20 border-amber-500/30';
      default:
        return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Top Contributors</h3>
        </div>
        <div className="space-y-3">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
              <div className="w-12 h-6 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-100">Top Contributors</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-5 h-5 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-100">Top Contributors</h3>
      </div>

      <div className="space-y-3">
        {contributors.map((contributor) => (
          <div
            key={contributor.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-gray-800/50 ${getRankColor(contributor.rank)}`}
          >
            {/* Rank Icon */}
            <div className="flex-shrink-0">
              {getRankIcon(contributor.rank)}
            </div>

            {/* Contributor Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-100 truncate">
                  {contributor.name}
                </p>
                <span className="text-xs text-gray-500">#{contributor.rank}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{contributor.verifiedActivities} activities</span>
                <span>{contributor.totalHoursLogged.toFixed(0)}h logged</span>
              </div>
            </div>

            {/* Reputation Score */}
            <div className="flex-shrink-0 text-right min-w-[56px]">
              <p className="text-lg font-bold text-gray-100 tabular-nums">
                {contributor.reputationScore.toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">rep</p>
            </div>
          </div>
        ))}
      </div>

      {contributors.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No contributors data available</p>
        </div>
      )}

      {/* View All Link */}
      {contributors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <button
            onClick={() => window.location.href = '/team'}
            className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View All Contributors →
          </button>
        </div>
      )}
    </div>
  );
}