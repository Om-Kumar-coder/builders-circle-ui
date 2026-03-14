'use client';

import { useOwnershipData } from '../../hooks/useOwnershipData';
import { useAuth } from '../../context/AuthContext';
import { useParticipation } from '../../hooks/useParticipation';
import OwnershipCards from './OwnershipCards';
import OwnershipCardsSkeleton from './OwnershipCardsSkeleton';
import ParticipationCard from './ParticipationCard';
import ParticipationSummary from '../participation/ParticipationSummary';
import ContributionHeatmap from './ContributionHeatmap';
import AccountabilityStatus from './AccountabilityStatus';
import NotificationWidget from './NotificationWidget';
import TopContributors from './TopContributors';
import ContributorProgressTracker from './ContributorProgressTracker';
import ErrorState from './ErrorState';
import { RefreshCw } from 'lucide-react';

interface DashboardGridProps {
  userId: string;
  cycleId: string;
}

export default function DashboardGrid({ userId, cycleId }: DashboardGridProps) {
  const { data, loading, error, refetch } = useOwnershipData(userId, cycleId);
  const { user } = useAuth();
  const { participation } = useParticipation(userId, cycleId);
  
  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  // Map backend participation fields to ParticipationCard's expected shape
  const participationCardData = participation ? (() => {
    const statusMap: Record<string, 'Active' | 'At Risk' | 'Diminishing' | 'Paused'> = {
      active: 'Active',
      'at-risk': 'At Risk',
      grace: 'Active',
      paused: 'Paused',
    };
    const stallMap: Record<string, 'Active' | 'At Risk' | 'Diminishing' | 'Paused'> = {
      none: 'Active',
      grace: 'Active',
      active: 'Active',
      at_risk: 'At Risk',
      diminishing: 'Diminishing',
      paused: 'Paused',
    };

    // stallStage is more granular — prefer it
    const status = stallMap[participation.stallStage] ?? statusMap[participation.participationStatus] ?? 'Active';

    const lastActivity = participation.lastActivityDate
      ? (() => {
          const seconds = Math.floor((Date.now() - new Date(participation.lastActivityDate!).getTime()) / 1000);
          if (seconds < 60) return 'just now';
          if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
          if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
          return `${Math.floor(seconds / 86400)}d ago`;
        })()
      : 'No activity yet';

    const thresholdMap: Record<string, string> = {
      'At Risk': 'Diminishing soon — submit activity',
      Diminishing: 'Paused soon — submit activity now',
      Paused: 'Ownership decay active',
    };

    return {
      status,
      lastActivity,
      nextThreshold: thresholdMap[status] ?? '',
    };
  })() : undefined;

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1">
            Auto-refreshes every 60 seconds
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
            border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Row - Notifications and Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NotificationWidget userId={userId} />
        <ContributorProgressTracker userId={userId} cycleId={cycleId} />
      </div>

      {/* Participation Summary - Always visible */}
      <ParticipationSummary userId={userId} />

      {/* Ownership Cards Row */}
      {loading && !data ? (
        <OwnershipCardsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data ? (
        <OwnershipCards data={data} />
      ) : null}

      {/* Middle Row - Heatmap and Top Contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContributionHeatmap userId={userId} cycleId={cycleId} />
        </div>
        <div>
          <TopContributors limit={5} />
        </div>
      </div>

      {/* Participation Status and Accountability */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ParticipationCard data={participationCardData} />
          <AccountabilityStatus userId={userId} cycleId={cycleId} />
        </div>
      )}

      {/* Quick Actions */}
      {data && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <p className="text-sm text-gray-400 mb-4">Quick Actions</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <button 
              onClick={() => window.location.href = '/activity'}
              className="text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors"
            >
              Submit Activity
            </button>
            <button 
              onClick={() => window.location.href = '/build-cycles'}
              className="text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors"
            >
              View Build Cycles
            </button>
            <button 
              onClick={() => window.location.href = '/team'}
              className="text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors"
            >
              Team Activity
            </button>
            {isAdmin && (
              <button 
                onClick={() => window.location.href = '/insights'}
                className="text-left px-4 py-2 bg-indigo-800 hover:bg-indigo-700 rounded-lg text-sm text-indigo-200 transition-colors"
              >
                Analytics
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
