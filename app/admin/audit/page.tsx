'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import { databases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { Shield, Filter, RefreshCw, AlertCircle, Search } from 'lucide-react';

interface AuditEvent {
  $id: string;
  $createdAt: string;
  userId: string;
  cycleId: string;
  eventType: string;
  ownershipAmount: number;
  multiplierSnapshot?: number;
  reason?: string;
}

type FilterType = 'all' | 'multiplier_adjustment' | 'activity_submitted' | 'vesting' | 'admin_adjustment';

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchUserId, setSearchUserId] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'founder';

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      setError('');

      const queries: any[] = [
        Query.orderDesc('$createdAt'),
        Query.limit(100)
      ];

      if (filter !== 'all') {
        queries.push(Query.equal('eventType', filter));
      }

      if (searchUserId.trim()) {
        queries.push(Query.equal('userId', searchUserId.trim()));
      }

      const response = await databases.listDocuments(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
        process.env.NEXT_PUBLIC_APPWRITE_LEDGER_COLLECTION_ID || 'ownership_ledger',
        queries
      );

      setEvents(response.documents as any);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchAuditEvents();
    }
  }, [user, isAdmin, filter]);

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
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'vest_matured':
      case 'vesting':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'multiplier_adjustment':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'admin_adjustment':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

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
        {/* Page Header */}
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
          {/* Event Type Filter */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Event Type:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'multiplier_adjustment', 'activity_submitted', 'vesting', 'admin_adjustment'] as FilterType[]).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterType
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  {filterType === 'all' ? 'All Events' : formatEventType(filterType)}
                </button>
              ))}
            </div>
          </div>

          {/* User Search */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Search className="w-4 h-4" />
              <span className="text-sm font-medium">User ID:</span>
            </div>
            <div className="flex-1 max-w-md flex gap-2">
              <input
                type="text"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="Enter user ID to filter..."
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                  text-gray-200 placeholder-gray-500 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
              <button
                onClick={fetchAuditEvents}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg 
                  text-sm font-medium transition-colors"
              >
                Search
              </button>
              {searchUserId && (
                <button
                  onClick={() => {
                    setSearchUserId('');
                    setTimeout(fetchAuditEvents, 100);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg 
                    text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Audit Timeline */}
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
                {filter !== 'all' || searchUserId 
                  ? 'Try adjusting your filters' 
                  : 'Audit events will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.$id}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border ${getEventColor(event.eventType)}`}>
                      <span className="text-xl">{getEventIcon(event.eventType)}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-medium text-gray-200">
                            {formatEventType(event.eventType)}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(event.$createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">User ID:</span>
                          <p className="text-gray-300 font-mono text-xs truncate">
                            {event.userId}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cycle ID:</span>
                          <p className="text-gray-300 font-mono text-xs truncate">
                            {event.cycleId}
                          </p>
                        </div>
                        {event.ownershipAmount !== 0 && (
                          <div>
                            <span className="text-gray-500">Ownership:</span>
                            <p className={`font-medium ${event.ownershipAmount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {event.ownershipAmount > 0 ? '+' : ''}{event.ownershipAmount.toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {event.multiplierSnapshot !== undefined && (
                          <div>
                            <span className="text-gray-500">Multiplier:</span>
                            <p className="text-gray-300 font-medium">
                              {event.multiplierSnapshot.toFixed(2)}×
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Reason */}
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
