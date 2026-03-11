'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useActivity } from '@/hooks/useActivity';
import { useCycles } from '@/hooks/useCycles';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import ActivityItem from '@/components/activity/ActivityItem';
import SubmitActivityForm from '@/components/activity/SubmitActivityForm';
import { Filter, RefreshCw, Plus, ChevronDown } from 'lucide-react';

type FilterType = 'all' | 'verified' | 'pending' | 'rejected';

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  
  // Fetch cycles to allow user selection
  const { cycles, loading: cyclesLoading } = useCycles();
  
  // Get active cycles (user can submit activities to active cycles)
  const activeCycles = cycles.filter(cycle => cycle.state === 'active');
  
  // Auto-select first active cycle if none selected
  const cycleId = selectedCycleId || (activeCycles.length > 0 ? activeCycles[0].id : '');
  
  const { activities, loading, error, refetch } = useActivity(user?.id || '', cycleId);

  console.log('🔍 Activity Page Debug:', {
    userId: user?.id,
    selectedCycleId,
    cycleId,
    activeCyclesCount: activeCycles.length,
    activitiesCount: activities.length
  });

  // Filter activities based on selected filter
  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter(activity => activity.verified === filter);
  }, [activities, filter]);

  // Count by status
  const counts = useMemo(() => {
    return {
      all: activities.length,
      verified: activities.filter(a => a.verified === 'verified').length,
      pending: activities.filter(a => a.verified === 'pending').length,
      rejected: activities.filter(a => a.verified === 'rejected').length,
    };
  }, [activities]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Activity">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view your activity.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Activity">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Activity History</h1>
            <p className="text-gray-400 mt-1">Track your submitted work and verification status</p>
          </div>
          <div className="flex items-center gap-3">
            {activeCycles.length > 0 && (
              <button
                onClick={() => setShowSubmitForm(!showSubmitForm)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 
                  text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Activity</span>
              </button>
            )}
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
        </div>

        {/* Cycle Selection */}
        {activeCycles.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-300">Active Cycle:</label>
              <div className="relative">
                <select
                  value={cycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-8 
                    text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {activeCycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              {cycleId && (
                <span className="text-xs text-gray-500">
                  {activities.length} activities submitted
                </span>
              )}
            </div>
          </div>
        )}

        {/* No Active Cycles Warning */}
        {activeCycles.length === 0 && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 text-yellow-400 px-4 py-3 rounded-lg">
            <p className="font-medium">No active build cycles</p>
            <p className="text-sm text-yellow-400/80 mt-1">
              Activities can only be submitted to active cycles. Contact an admin to start a new cycle.
            </p>
          </div>
        )}

        {/* Submit Activity Form */}
        {showSubmitForm && cycleId && (
          <SubmitActivityForm
            userId={user!.id}
            cycleId={cycleId}
            onSuccess={() => {
              setShowSubmitForm(false);
              refetch();
            }}
          />
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-100">{counts.all}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Verified</p>
            <p className="text-2xl font-bold text-green-400">{counts.verified}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{counts.pending}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Rejected</p>
            <p className="text-2xl font-bold text-red-400">{counts.rejected}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filter:</span>
            </div>
            <div className="flex gap-2">
              {(['all', 'verified', 'pending', 'rejected'] as FilterType[]).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterType
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  <span className="ml-1.5 text-xs opacity-75">
                    ({counts[filterType]})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Activity Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Activity Timeline</h2>
            <span className="text-sm text-gray-400">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-700 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">📋</div>
              <p className="text-gray-400 mb-2">
                {filter === 'all' 
                  ? 'No activity submitted yet' 
                  : `No ${filter} activities`}
              </p>
              <p className="text-sm text-gray-500">
                {filter === 'all'
                  ? 'Submit your first activity to start tracking your progress'
                  : 'Try changing the filter to see other activities'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
