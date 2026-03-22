'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import {
  Shield, Filter, RefreshCw, AlertCircle,
  Search, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

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

interface Filters {
  action: string;
  adminSearch: string;
  targetSearch: string;
  startDate: string;
  endDate: string;
}

const EMPTY: Filters = { action: 'all', adminSearch: '', targetSearch: '', startDate: '', endDate: '' };

const ACTION_TYPES = [
  'all', 'multiplier_restore', 'ownership_override', 'role_change',
  'stall_clear', 'dispute_resolution', 'manual_job_execution',
  'manual_cycle_finalization', 'threat_alert_dismissed',
] as const;

const PAGE_SIZE = 25;

const ACTION_ICONS: Record<string, string> = {
  ownership_override: '💰', multiplier_restore: '⚡', role_change: '👤',
  stall_clear: '✅', dispute_resolution: '⚖️', manual_job_execution: '⚙️',
  manual_cycle_finalization: '🔄', threat_alert_dismissed: '🔕',
};

const ACTION_COLORS: Record<string, string> = {
  ownership_override:        'text-green-400   bg-green-500/10   border-green-500/20',
  multiplier_restore:        'text-yellow-400  bg-yellow-500/10  border-yellow-500/20',
  role_change:               'text-blue-400    bg-blue-500/10    border-blue-500/20',
  stall_clear:               'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  dispute_resolution:        'text-purple-400  bg-purple-500/10  border-purple-500/20',
  manual_job_execution:      'text-orange-400  bg-orange-500/10  border-orange-500/20',
  manual_cycle_finalization: 'text-cyan-400    bg-cyan-500/10    border-cyan-500/20',
  threat_alert_dismissed:    'text-gray-400    bg-gray-500/10    border-gray-500/20',
};

function fmt(action: string) {
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = usePermissions();

  const [events, setEvents]         = useState<AuditEvent[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const [draft, setDraft]     = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (filters: Filters, p: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.getAuditLogs({
        action:       filters.action !== 'all' ? filters.action : undefined,
        adminSearch:  filters.adminSearch.trim()  || undefined,
        targetSearch: filters.targetSearch.trim() || undefined,
        startDate:    filters.startDate || undefined,
        endDate:      filters.endDate   || undefined,
        page:  p,
        limit: PAGE_SIZE,
      });
      setEvents(result.logs ?? []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin) fetchPage(applied, page);
  }, [user, isAdmin, applied, page, fetchPage]);

  // Debounced text input — auto-applies after 600 ms
  function handleTextChange(field: 'adminSearch' | 'targetSearch', value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setApplied(next); setPage(1); }, 600);
  }

  // Action pill — applies immediately
  function handleActionClick(action: string) {
    const next = { ...draft, action };
    setDraft(next);
    setApplied(next);
    setPage(1);
  }

  // Date — applies immediately
  function handleDateChange(field: 'startDate' | 'endDate', value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setApplied(next);
    setPage(1);
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraft(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  }

  const hasActive = applied.action !== 'all' || applied.adminSearch || applied.targetSearch || applied.startDate || applied.endDate;

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
            <p className="text-gray-400">Admin access required.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Audit Log">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-400" /> Audit Log
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Complete transparency and traceability</p>
          </div>
          <button
            onClick={() => fetchPage(applied, page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {hasActive && (
                <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">active</span>
              )}
            </div>
            {hasActive && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>

          {/* Action pills */}
          <div className="flex gap-2 flex-wrap">
            {ACTION_TYPES.map(f => (
              <button
                key={f}
                onClick={() => handleActionClick(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  draft.action === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {f === 'all' ? 'All Actions' : fmt(f)}
              </button>
            ))}
          </div>

          {/* Search + date inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={draft.adminSearch}
                onChange={e => handleTextChange('adminSearch', e.target.value)}
                placeholder="Admin name or email…"
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={draft.targetSearch}
                onChange={e => handleTextChange('targetSearch', e.target.value)}
                placeholder="Target user name or email…"
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 pl-0.5">From</label>
              <input
                type="date"
                value={draft.startDate}
                max={draft.endDate || undefined}
                onChange={e => handleDateChange('startDate', e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 pl-0.5">To</label>
              <input
                type="date"
                value={draft.endDate}
                min={draft.startDate || undefined}
                onChange={e => handleDateChange('endDate', e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Audit Timeline</h2>
            <span className="text-sm text-gray-400">
              {loading ? '…' : `${total} ${total === 1 ? 'event' : 'events'}`}
              {hasActive && !loading && ' (filtered)'}
            </span>
          </div>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-1/3" />
                      <div className="h-3 bg-gray-700 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">📋</div>
              <p className="text-gray-400 mb-2">No audit events found</p>
              <p className="text-sm text-gray-500">
                {hasActive ? 'Try adjusting your filters' : 'Audit events will appear here'}
              </p>
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="space-y-3">
              {events.map(event => (
                <div key={event.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border text-xl ${ACTION_COLORS[event.action] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
                      {ACTION_ICONS[event.action] ?? '📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-medium text-gray-200 text-sm">{fmt(event.action)}</h3>
                        <time className="text-xs text-gray-500 shrink-0">
                          {new Date(event.timestamp).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </time>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="text-gray-500">Admin: </span>
                          <span className="text-gray-300">{event.admin?.name || event.admin?.email || event.adminId}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Target: </span>
                          <span className="text-gray-300">{event.targetUser?.name || event.targetUser?.email || event.targetUserId}</span>
                        </div>
                        {event.newValue && (
                          <div className="col-span-2 md:col-span-1">
                            <span className="text-gray-500">New value: </span>
                            <span className="text-gray-300 font-mono">{event.newValue}</span>
                          </div>
                        )}
                      </div>
                      {event.reason && (
                        <div className="mt-2 px-2.5 py-1.5 bg-gray-900/60 rounded text-xs text-gray-400">
                          <span className="font-medium text-gray-300">Reason: </span>{event.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
              <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
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
                  disabled={page === totalPages}
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
