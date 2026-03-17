'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import { Shield, Filter, RefreshCw, AlertCircle, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface AuditEvent {
  id: string;
  timestamp: string;
  adminId: string;
  admin?: { id: string; email: string; name: string };
  targetUserId: string;
  targetUser?: { id: string; email: string; name: string };
  action: string;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
}

const ACTION_TYPES = [
  'all', 'multiplier_restore', 'ownership_override', 'role_change',
  'stall_clear', 'dispute_resolution', 'manual_job_execution', 'manual_cycle_finalization',
] as const;
type ActionFilter = typeof ACTION_TYPES[number];

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    action: 'all' as ActionFilter, adminSearch: '', targetSearch: '', startDate: '', endDate: '',
  });

  const fetchAuditEvents = useCallback(async (filters = appliedFilters, currentPage = page) => {
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.getAuditLogs({
        action: filters.action !== 'all' ? filters.action : undefined,
        targetUserId: filters.targetSearch.trim() || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
      let logs: AuditEvent[] = result.logs ?? [];
      if (filters.adminSearch.trim()) {
        const s = filters.adminSearch.trim().toLowerCase();
        logs = logs.filter(e =>
          e.admin?.name?.toLowerCase().includes(s) ||
          e.admin?.email?.toLowerCase().includes(s) ||
          e.adminId.toLowerCase().includes(s)
        );
      }
      setEvents(logs);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && isAdmin) fetchAuditEvents(appliedFilters, page);
  }, [user, isAdmin, appliedFilters, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    const next = { action: actionFilter, adminSearch, targetSearch, startDate, endDate };
    setAppliedFilters(next);
    setPage(1);
    fetchAuditEvents(next, 1);
  };

  const clearFilters = () => {
    setActionFilter('all'); setAdminSearch(''); setTargetSearch(''); setStartDate(''); setEndDate('');
    const next = { action: 'all' as ActionFilter, adminSearch: '', targetSearch: '', startDate: '', endDate: '' };
    setAppliedFilters(next);
    setPage(1);
    fetchAuditEvents(next, 1);
  };

  const hasActiveFilters = appliedFilters.action !== 'all' || appliedFilters.adminSearch ||
    appliedFilters.targetSearch || appliedFilters.startDate || appliedFilters.endDate;

  const getEventIcon = (action: string) => {
    const icons: Record<string, string> = {
      ownership_override: '💰', multiplier_restore: '⚡', role_change: '👤',
      stall_clear: '✅', dispute_resolution: '⚖️', manual_job_execution: '⚙️',
      manual_cycle_finalization: '🔄',
    };
    return icons[action] ?? '📝';
  };

  const getEventColor = (action: string) => {
    const colors: Record<string, string> = {
      ownership_override: 'text-green-400 bg-green-500/10 border-green-500/20',
      multiplier_restore: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      role_change: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      stall_clear: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      dispute_resolution: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      manual_job_execution: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      manual_cycle_finalization: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    };
    return colors[action] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  };

  const formatAction = (action: string) =>
    action ? action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown';

  if (authLoading) return <LoadingScreen />;
  if (!user) {
    return (
      <MainLayout title="Audit Log">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-400">Please log in to view audit logs.</p>
        </div>
      </MainLayout>
    );
  }
  if (!isAdmin) {
    return (
      <MainLayout title="Audit Log">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <p className="text-gray-400">Admin access required to view audit logs.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Audit Log">
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-400" />
              Audit Log
            </h1>
            <p className="text-gray-400 mt-1">Complete transparency and traceability</p>
          </div>
          <button
            onClick={() => fetchAuditEvents(appliedFilters, page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">active</span>
              )}
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {ACTION_TYPES.map((f) => (
              <button
                key={f}
                onClick={() => setActionFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  actionFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {f === 'all' ? 'All Actions' : formatAction(f)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text" value={adminSearch} onChange={e => setAdminSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder="Admin name or email..."
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text" value={targetSearch} onChange={e => setTargetSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder="Target user ID, name, email..."
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              title="Start date"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
            />
            <input
              type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              title="End date"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Audit Timeline</h2>
            <span className="text-sm text-gray-400">
              {total} total {total === 1 ? 'event' : 'events'}{hasActiveFilters && ' (filtered)'}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
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
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">📋</div>
              <p className="text-gray-400 mb-2">No audit events found</p>
              <p className="text-sm text-gray-500">{hasActiveFilters ? 'Try adjusting your filters' : 'Audit events will appear here'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border ${getEventColor(event.action)}`}>
                      <span className="text-xl">{getEventIcon(event.action)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <h3 className="font-medium text-gray-200">{formatAction(event.action)}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(event.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Admin:</span>
                          <p className="text-gray-300 text-xs truncate">{event.admin?.name || event.admin?.email || event.adminId}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Target User:</span>
                          <p className="text-gray-300 text-xs truncate">{event.targetUser?.name || event.targetUser?.email || event.targetUserId}</p>
                        </div>
                        {event.newValue && (
                          <div>
                            <span className="text-gray-500 text-xs">New Value:</span>
                            <p className="text-gray-300 font-mono text-xs truncate">{event.newValue}</p>
                          </div>
                        )}
                      </div>
                      {event.reason && (
                        <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
                          <span className="font-medium text-gray-300">Reason:</span> {event.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
              <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button
                      key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
