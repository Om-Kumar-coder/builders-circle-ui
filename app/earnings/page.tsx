'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOwnershipData } from '@/hooks/useOwnershipData';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { TrendingUp, Coins, Percent, Zap, RefreshCw, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface LedgerEvent {
  id: string;
  createdAt: string;
  eventType: string;
  ownershipAmount: number;
  multiplierSnapshot?: number;
  reason?: string;
}

export default function EarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const cycleId = 'cycle456'; // TODO: Get from context
  
  const { data, loading, error, refetch } = useOwnershipData(user?.$id || '', cycleId);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  useEffect(() => {
    const fetchLedgerEvents = async () => {
      if (!user?.$id) return;
      
      try {
        setLedgerLoading(true);
        const response = await apiClient.getOwnership(user.$id, cycleId);
        
        if (response.success && response.entries) {
          // Transform the entries to match our interface
          const transformedEvents = response.entries.map((entry: any) => ({
            id: entry.id,
            createdAt: entry.createdAt,
            eventType: entry.eventType || 'ownership_change',
            ownershipAmount: entry.ownershipAmount,
            multiplierSnapshot: entry.multiplierSnapshot,
            reason: entry.reason
          }));
          setLedgerEvents(transformedEvents);
        } else {
          setLedgerEvents([]);
        }
      } catch (err) {
        console.error('Error fetching ledger events:', err);
        setLedgerEvents([]);
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedgerEvents();
  }, [user?.$id, cycleId]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <MainLayout title="Earnings">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view your earnings.</p>
        </div>
      </MainLayout>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'activity_submitted':
      case 'contribution_approved':
        return '✅';
      case 'vest_matured':
      case 'vesting':
        return '🔒';
      case 'multiplier_adjustment':
        return '⚡';
      case 'admin_adjustment':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'activity_submitted':
      case 'contribution_approved':
        return 'text-green-400';
      case 'vest_matured':
      case 'vesting':
        return 'text-blue-400';
      case 'multiplier_adjustment':
        return 'text-yellow-400';
      case 'admin_adjustment':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <MainLayout title="Earnings">
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Earnings & Ownership</h1>
            <p className="text-gray-400 mt-1">Track your ownership and understand the mechanics</p>
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

        {/* Ownership Cards */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Vested Ownership */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-gray-400 font-medium">Vested Ownership</span>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Coins className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-100">{data.vested.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-2">Locked & permanent</p>
            </div>

            {/* Provisional Ownership */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-gray-400 font-medium">Provisional Ownership</span>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-100">{data.provisional.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-2">Subject to multiplier</p>
            </div>

            {/* Current Multiplier */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-gray-400 font-medium">Current Multiplier</span>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Percent className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-100">{data.multiplier.toFixed(2)}×</p>
              <p className="text-xs text-gray-500 mt-2">
                {data.multiplier === 1 ? 'Full influence' : 
                 data.multiplier === 0.75 ? 'At risk' :
                 data.multiplier === 0.5 ? 'Diminishing' : 'Paused'}
              </p>
            </div>

            {/* Effective Ownership */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ring-2 ring-indigo-500/20">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm text-gray-400 font-medium">Effective Ownership</span>
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <Zap className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-indigo-400">{data.effective.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-2">Total current influence</p>
            </div>
          </div>
        ) : null}

        {/* Ownership Breakdown Panel */}
        {data && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-semibold text-gray-100">Ownership Breakdown</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <span className="text-gray-300">Vested Total</span>
                <span className="text-lg font-semibold text-blue-400">{data.vested.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <span className="text-gray-300">Provisional Total</span>
                <span className="text-lg font-semibold text-yellow-400">{data.provisional.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <span className="text-gray-300">Multiplier Applied</span>
                <span className="text-lg font-semibold text-purple-400">{data.multiplier.toFixed(2)}×</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-indigo-900/20 border border-indigo-800/50 rounded-lg">
                <span className="text-gray-200 font-medium">Effective Result</span>
                <span className="text-xl font-bold text-indigo-400">{data.effective.toFixed(2)}%</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <p className="text-sm text-gray-400 leading-relaxed">
                <span className="font-semibold text-gray-300">How it works:</span> Your effective ownership is calculated as 
                vested ownership (permanent) plus provisional ownership multiplied by your activity multiplier. 
                Stay active to maintain full influence!
              </p>
            </div>
          </div>
        )}

        {/* Ledger Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Ownership Ledger</h2>

          {ledgerLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : ledgerEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">📊</div>
              <p className="text-gray-400 mb-2">No ledger events yet</p>
              <p className="text-sm text-gray-500">
                Your ownership changes will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ledgerEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getEventIcon(event.eventType)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-medium ${getEventColor(event.eventType)}`}>
                          {formatEventType(event.eventType)}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(event.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {event.ownershipAmount !== 0 && (
                          <span className="text-gray-400">
                            Amount: <span className="text-gray-200 font-medium">
                              {event.ownershipAmount > 0 ? '+' : ''}{event.ownershipAmount.toFixed(2)}%
                            </span>
                          </span>
                        )}
                        {event.multiplierSnapshot !== undefined && (
                          <span className="text-gray-400">
                            Multiplier: <span className="text-gray-200 font-medium">
                              {event.multiplierSnapshot.toFixed(2)}×
                            </span>
                          </span>
                        )}
                      </div>
                      {event.reason && (
                        <p className="text-xs text-gray-500 mt-1">{event.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
