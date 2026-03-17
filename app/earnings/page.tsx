'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCycle } from '@/context/CycleContext';
import { useOwnershipData } from '@/hooks/useOwnershipData';
import { useFilters } from '@/hooks/useFilters';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import EarningsProjectionCard from '@/components/dashboard/EarningsProjectionCard';
import FilterBar from '@/components/ui/FilterBar';
import ExportButton from '@/components/ui/ExportButton';
import { TrendingUp, Coins, Percent, Zap, RefreshCw, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const LEDGER_TYPE_OPTIONS = [
  { value: 'contribution_approved', label: 'Contribution Approved' },
  { value: 'ownership_decay', label: 'Ownership Decay' },
  { value: 'multiplier_recovery', label: 'Multiplier Recovery' },
  { value: 'admin_override', label: 'Admin Override' },
  { value: 'vesting', label: 'Vesting' },
];

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
  const { activeCycle } = useCycle();
  const cycleId = activeCycle?.id || '';

  const { data, loading, error, refetch } = useOwnershipData(user?.id || '', cycleId);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [isViewOnly, setIsViewOnly] = useState(false);

  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilters();

  const formatPercentage = (value: number) => {
    if (value === 0) return '0.00';
    if (value < 0.01) return '<0.01';
    return value.toFixed(2);
  };

  useEffect(() => {
    const fetchLedgerEvents = async () => {
      if (!user?.id) return;
      try {
        setLedgerLoading(true);
        const ownershipData = await apiClient.getOwnership(user.id, cycleId);
        if (ownershipData?.entries) {
          setLedgerEvents(ownershipData.entries.map((e: LedgerEvent) => ({
            id: e.id,
            createdAt: e.createdAt,
            eventType: e.eventType || 'ownership_change',
            ownershipAmount: e.ownershipAmount,
            multiplierSnapshot: e.multiplierSnapshot,
            reason: e.reason,
          })));
        } else {
          setLedgerEvents([]);
        }
      } catch {
        setLedgerEvents([]);
      } finally {
        setLedgerLoading(false);
      }
    };
    fetchLedgerEvents();
  }, [user?.id, cycleId]);

  // Check view-only status
  useEffect(() => {
    if (!user?.id) return;
    apiClient.adminGetAccessGrants(user.id)
      .then(grants => {
        const now = new Date();
        const viewOnly = grants.some((g: { type: string; revokedAt: string | null; expiresAt: string | null }) =>
          g.type === 'view_only' && !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt) > now)
        );
        setIsViewOnly(viewOnly);
      })
      .catch(() => {});
  }, [user?.id]);

  // Filter ledger events client-side
  const filteredEvents = useMemo(() => {
    return ledgerEvents.filter(e => {
      if (filters.type && e.eventType !== filters.type) return false;
      if (filters.startDate && new Date(e.createdAt) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(e.createdAt) > new Date(filters.endDate)) return false;
      return true;
    });
  }, [ledgerEvents, filters]);

  if (authLoading) return <LoadingScreen />;
  if (!user) return (
    <MainLayout title="Earnings">
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Please log in to view your earnings.</p>
      </div>
    </MainLayout>
  );

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'contribution_approved': return '✅';
      case 'vesting': return '🔒';
      case 'multiplier_adjustment': case 'multiplier_recovery': return '⚡';
      case 'admin_override': return '⚙️';
      case 'ownership_decay': return '📉';
      default: return '📝';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'contribution_approved': return 'text-green-400';
      case 'vesting': return 'text-blue-400';
      case 'multiplier_adjustment': case 'multiplier_recovery': return 'text-yellow-400';
      case 'admin_override': return 'text-purple-400';
      case 'ownership_decay': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatEventType = (t: string) =>
    t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <MainLayout title="Earnings">
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Earnings & Ownership</h1>
            <p className="text-gray-400 mt-1">Track your ownership and projected earnings</p>
          </div>
          <div className="flex items-center gap-2">
            {!isViewOnly && (
              <ExportButton type="ownership" format="csv" disabled={isViewOnly} />
            )}
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isViewOnly && (
          <div className="bg-yellow-900/20 border border-yellow-800/50 text-yellow-400 px-4 py-3 rounded-lg text-sm">
            You have view-only access. Exports and downloads are disabled.
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-gray-800 rounded w-1/2 mb-4" />
                <div className="h-8 bg-gray-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : data ? (
          <>
            {/* Ownership Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm text-gray-400 font-medium">Vested Ownership</span>
                  <div className="p-2 rounded-lg bg-blue-500/10"><Coins className="w-5 h-5 text-blue-400" /></div>
                </div>
                <p className="text-3xl font-bold text-gray-100">{formatPercentage(data.vested)}%</p>
                <p className="text-xs text-gray-500 mt-2">Locked & permanent</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm text-gray-400 font-medium">Provisional Ownership</span>
                  <div className="p-2 rounded-lg bg-yellow-500/10"><TrendingUp className="w-5 h-5 text-yellow-400" /></div>
                </div>
                <p className="text-3xl font-bold text-gray-100">{formatPercentage(data.provisional)}%</p>
                <p className="text-xs text-gray-500 mt-2">Subject to multiplier</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm text-gray-400 font-medium">Current Multiplier</span>
                  <div className="p-2 rounded-lg bg-purple-500/10"><Percent className="w-5 h-5 text-purple-400" /></div>
                </div>
                <p className="text-3xl font-bold text-gray-100">{data.multiplier.toFixed(1)}×</p>
                <p className="text-xs text-gray-500 mt-2">
                  {data.multiplier >= 1 ? 'Full influence' : data.multiplier >= 0.75 ? 'At risk' : data.multiplier >= 0.5 ? 'Diminishing' : 'Paused'}
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ring-2 ring-indigo-500/20">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm text-gray-400 font-medium">Effective Ownership</span>
                  <div className="p-2 rounded-lg bg-indigo-500/10"><Zap className="w-5 h-5 text-indigo-400" /></div>
                </div>
                <p className="text-3xl font-bold text-indigo-400">{formatPercentage(data.effective)}%</p>
                <p className="text-xs text-gray-500 mt-2">Total current influence</p>
              </div>
            </div>

            {/* Earnings Projection Card */}
            <EarningsProjectionCard
              vestedOwnership={data.vested}
              provisionalOwnership={data.provisional}
              multiplier={data.multiplier}
              effectiveOwnership={data.effective}
            />

            {/* Ownership Breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Info className="w-5 h-5 text-indigo-400" />
                <h2 className="text-xl font-semibold text-gray-100">Ownership Breakdown</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <span className="text-gray-300">Vested Total</span>
                  <span className="text-lg font-semibold text-blue-400">{formatPercentage(data.vested)}%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <span className="text-gray-300">Provisional Total</span>
                  <span className="text-lg font-semibold text-yellow-400">{formatPercentage(data.provisional)}%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <span className="text-gray-300">Multiplier Applied</span>
                  <span className="text-lg font-semibold text-purple-400">{data.multiplier.toFixed(1)}×</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-indigo-900/20 border border-indigo-800/50 rounded-lg">
                  <span className="text-gray-200 font-medium">Effective Result</span>
                  <span className="text-xl font-bold text-indigo-400">{formatPercentage(data.effective)}%</span>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                <p className="text-sm text-gray-400 leading-relaxed">
                  <span className="font-semibold text-gray-300">Formula: </span>
                  effectiveOwnership = vested + (provisional × multiplier). Stay active to maintain full influence.
                </p>
              </div>
            </div>
          </>
        ) : null}

        {/* Ledger Timeline with Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-100">Ownership Ledger</h2>
            {!isViewOnly && <ExportButton type="ownership" format="csv" disabled={isViewOnly} label="Export Ledger" />}
          </div>

          <FilterBar
            filters={filters}
            setFilter={setFilter}
            resetFilters={resetFilters}
            hasActiveFilters={hasActiveFilters}
            showType
            typeOptions={LEDGER_TYPE_OPTIONS}
          />

          <div className="mt-4">
            {ledgerLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-1/3" />
                        <div className="h-3 bg-gray-700 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4 opacity-50">📊</div>
                <p className="text-gray-400 mb-2">{hasActiveFilters ? 'No events match your filters' : 'No ledger events yet'}</p>
                <p className="text-sm text-gray-500">Your ownership changes will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map(event => (
                  <div key={event.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{getEventIcon(event.eventType)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className={`font-medium ${getEventColor(event.eventType)}`}>
                            {formatEventType(event.eventType)}
                          </h3>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {event.ownershipAmount !== 0 && (
                            <span className="text-gray-400">
                              Amount: <span className="text-gray-200 font-medium">
                                {event.ownershipAmount > 0 ? '+' : ''}{event.ownershipAmount.toFixed(3)}%
                              </span>
                            </span>
                          )}
                          {event.multiplierSnapshot !== undefined && (
                            <span className="text-gray-400">
                              Multiplier: <span className="text-gray-200 font-medium">{event.multiplierSnapshot.toFixed(2)}×</span>
                            </span>
                          )}
                        </div>
                        {event.reason && <p className="text-xs text-gray-500 mt-1">{event.reason}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
