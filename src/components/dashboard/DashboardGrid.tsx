'use client';

import { useOwnershipData } from '../../hooks/useOwnershipData';
import OwnershipCards from './OwnershipCards';
import OwnershipCardsSkeleton from './OwnershipCardsSkeleton';
import ParticipationCard from './ParticipationCard';
import ParticipationSummary from '../participation/ParticipationSummary';
import ErrorState from './ErrorState';
import { RefreshCw } from 'lucide-react';

interface DashboardGridProps {
  userId: string;
  cycleId: string;
}

export default function DashboardGrid({ userId, cycleId }: DashboardGridProps) {
  const { data, loading, error, refetch } = useOwnershipData(userId, cycleId);

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Your Ownership</h2>
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

      {/* Participation Status Card */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ParticipationCard />
          </div>
          
          {/* Quick Actions */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <p className="text-sm text-gray-400 mb-4">Quick Actions</p>
            <div className="space-y-2">
              <button className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors">
                Submit Work
              </button>
              <button className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors">
                View Build Cycles
              </button>
              <button className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 transition-colors">
                Team Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
