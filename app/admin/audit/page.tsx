'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { apiClient } from '@/lib/api-client';
import { Shield, Filter, RefreshCw, AlertCircle, Search } from 'lucide-react';

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

type FilterType = 'all' | 'multiplier_restore' | 'ownership_override' | 'role_change' | 'stall_clear' | 'dispute_resolution' | 'manual_job_execution';

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchUserId, setSearchUserId] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const fetchAuditEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.getAuditLogs();
      let filteredEvents: AuditEvent[] = Array.isArray(response) ? response : [];

      if (filter !== 'all') {
        filteredEvents = filteredEvents.filter((event) => event.action === filter);
      }

      if (searchUserId.trim()) {
        const search = searchUserId.trim().toLowerCase();
        filteredEvents = filteredEvents.filter((event) =>
          event.targetUserId?.toLowerCase().includes(search) ||
          event.targetUser?.email?.toLowerCase().includes(search) ||
          event.targetUser?.name?.toLowerCase().includes(search)
        );
      }

      setEvents(filteredEvents);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, [filter, searchUserId]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAuditEvents();
    }
  }, [user, isAdmin, fetchAuditEvents]);

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'ownership_override': return '💰';
      case 'multiplier_restore': return '⚡';
      case 'role_change': return '👤';
      case 'stall_clear': return '✅';
      case 'dispute_resolution': return '⚖️';
      case 'manual_job_execution': return '⚙️';
      default: return '📝';
    }
  };

  const getEventColor = (action: string) => {
    switch (action) {
      case 'ownership_override': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'multiplier_restore': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'role_change': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'stall_clear': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'dispute_resolution': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'manual_job_execution': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatAction = (action: string | undefined | null) => {
    if (!action) return 'Unknown Action';
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-400" />
              Audit Log
            </h1>
            <p className="text-gray-400 mt-1">Complete transparency and traceability</p>
          </div>
          <button
            onClick={fetchAuditEvents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
              border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Action Type:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'ownership_override', 'multiplier_restore', 'role_change', 'stall_clear', 'dispute_resolution', 'manual_job_execution'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All Actions' : formatAction(f)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Search className="w-4 h-4" />
              <span className="text-sm font-medium">Target User:</span>
            </div>
            <div className="flex-1 max-w-md flex gap-2">
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="Search by user ID, name, or email..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                  text-gray-200 placeholder-gray-500 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
              <button
                onClick={fetchAuditEvents}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Search
              </button>
              {searchUserId && (
                <button
                  onClick={() => { setSearchUserId(''); setTimeout(fetchAuditEvents, 100); }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-100">Audit Timeline</h2>
            <span className="text-sm text-gray-400">
              {events.length} {events.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
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
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 opacity-50">📋</div>
              <p className="text-gray-400 mb-2">No audit events found</p>
              <p className="text-sm text-gray-500">
                {filter !== 'all' || searchUserId ? 'Try adjusting your filters' : 'Audit events will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border ${getEventColor(event.action)}`}>
                      <span className="text-xl">{getEventIcon(event.action)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-medium text-gray-200">{formatAction(event.action)}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(event.timestamp).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Admin:</span>
                          <p className="text-gray-300 text-xs truncate">
                            {event.admin?.name || event.admin?.email || event.adminId}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Target User:</span>
                          <p className="text-gray-300 text-xs truncate">
                            {event.targetUser?.name || event.targetUser?.email || event.targetUserId}
                          </p>
                        </div>
                        {event.newValue && (
                          <div>
                            <span className="text-gray-500">New Value:</span>
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
        </div>
      </div>
    </MainLayout>
  );
}
