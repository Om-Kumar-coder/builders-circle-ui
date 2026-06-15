'use client';

import { useOwnershipData } from '../../hooks/useOwnershipData';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
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
import AssignedTasksWidget from './AssignedTasksWidget';
import AccessExpiryWidget from './AccessExpiryWidget';
import SecurityNoticesWidget from './SecurityNoticesWidget';
import RulesBanner from './RulesBanner';
import TierBadge, { deriveTier } from './TierBadge';
import GroupBadge from './GroupBadge';
import { RefreshCw } from 'lucide-react';

interface DashboardGridProps {
  userId: string;
  cycleId: string;
}

export default function DashboardGrid({ userId, cycleId }: DashboardGridProps) {
  const { data, loading, error, refetch } = useOwnershipData(userId, cycleId);
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { participation } = useParticipation(userId, cycleId);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100">Dashboard</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge tier={deriveTier(user?.role, data?.effective)} size="sm" />
            <GroupBadge />
            <span className="text-xs text-gray-500">·</span>
            <p className="text-xs text-gray-500">Auto-refreshes every 60s</p>
          </div>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 
            border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Rules Banner */}
      <RulesBanner />

      {/* Security & Access Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityNoticesWidget />
        <AccessExpiryWidget />
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

      {/* Assigned Tasks Widget */}
      <AssignedTasksWidget cycleId={cycleId} />

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
            {!isAdmin && (
              <button
                onClick={() => window.location.href = '/ideas/submit'}
                className="text-left px-4 py-2 bg-yellow-800/50 hover:bg-yellow-800 rounded-lg text-sm text-yellow-200 transition-colors"
              >
                Submit an Idea
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
