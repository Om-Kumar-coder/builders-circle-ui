'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCycle } from '@/context/CycleContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useLogs } from '@/hooks/useLogs';
import { useFilters } from '@/hooks/useFilters';
import MainLayout from '@/components/layout/MainLayout';
import LoadingScreen from '@/components/auth/LoadingScreen';
import FilterBar from '@/components/ui/FilterBar';
import ExportButton from '@/components/ui/ExportButton';
import {
  TrendingUp, Users, Activity, AlertCircle, BarChart3, PieChart,
  RefreshCw, Folder, FolderOpen, Shield, Settings, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = { active: '#10b981', atRisk: '#f59e0b', diminishing: '#f97316', paused: '#ef4444' };

type FolderKey = 'overview' | 'ownership' | 'security' | 'admin' | 'participation';

const FOLDERS: { key: FolderKey; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'ownership', label: 'Ownership', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { key: 'admin', label: 'Admin Actions', icon: <Settings className="w-4 h-4" />, adminOnly: true },
  { key: 'participation', label: 'Participation', icon: <Users className="w-4 h-4" /> },
];

const LOG_TYPE_OPTIONS = [
  { value: 'ownership', label: 'Ownership' },
  { value: 'admin', label: 'Admin Actions' },
  { value: 'security', label: 'Security' },
  { value: 'participation', label: 'Participation' },
];

export default function InsightsPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeCycle } = useCycle();
  const cycleId = activeCycle?.id || '';
  const { analytics, loading, error, refetch } = useAnalytics(cycleId);
  const [activeFolder, setActiveFolder] = useState<FolderKey>('overview');

  const { filters, setFilter, resetFilters, hasActiveFilters, toQueryParams } = useFilters();
  const { byType, loading: logsLoading, refetch: refetchLogs } = useLogs(
    activeFolder !== 'overview' ? { ...toQueryParams(), type: activeFolder } : {}
  );
  const { isAdmin } = usePermissions();

  if (authLoading) return <LoadingScreen />;
  if (!user) return (
    <MainLayout title="Insights">
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Please log in to view insights.</p>
      </div>
    </MainLayout>
  );

  if (!isAdmin) return (
    <MainLayout title="Insights">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-gray-400">Admin access required to view insights.</p>
        </div>
      </div>
    </MainLayout>
  );

  const stallStageData = analytics ? [
    { name: 'Active', value: analytics.participationHealth.active, color: COLORS.active },
    { name: 'At Risk', value: analytics.participationHealth.atRisk, color: COLORS.atRisk },
    { name: 'Diminishing', value: analytics.participationHealth.diminishing, color: COLORS.diminishing },
    { name: 'Paused', value: analytics.participationHealth.paused, color: COLORS.paused },
  ] : [];

  const activityTrendData = analytics ? [
    { name: 'Total', value: analytics.totalSubmissions },
    { name: 'Avg/User', value: Math.round(analytics.avgFrequency * 10) / 10 },
    { name: 'Inactive', value: analytics.inactiveUsers },
  ] : [];

  const totalParticipants = analytics
    ? analytics.participationHealth.active + analytics.participationHealth.atRisk +
      analytics.participationHealth.diminishing + analytics.participationHealth.paused
    : 0;

  const currentLogs = byType[activeFolder] ?? [];

  const renderLogEntry = (log: Record<string, unknown>, i: number) => {
    const date = (log.createdAt || log.timestamp) as string;
    const label = (log.eventType || log.event || log.action || 'Event') as string;
    return (
      <div key={i} className="flex items-start justify-between p-3 bg-gray-800/50 rounded-lg text-sm">
        <div className="space-y-0.5">
          <p className="text-gray-200 font-medium capitalize">{String(label).replace(/_/g, ' ')}</p>
          {log.reason != null && <p className="text-xs text-gray-400">{String(log.reason)}</p>}
          {log.message != null && <p className="text-xs text-gray-400">{String(log.message)}</p>}
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
          {date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      </div>
    );
  };

  return (
    <MainLayout title="Insights">
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-100">Analytics & Insights</h1>
            <p className="text-gray-400 mt-1 text-sm">Participation health, logs, and behavior insights</p>
          </div>
          <button
            onClick={() => { refetch(); refetchLogs(); }}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50 text-sm w-fit"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Folder Navigation */}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {FOLDERS.filter(f => !f.adminOnly || isAdmin).map(f => {
            const isActive = activeFolder === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFolder(f.key)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                }`}
              >
                {isActive ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                {f.label}
                <ChevronRight className={`w-3 h-3 transition-transform ${isActive ? 'rotate-90' : ''}`} />
              </button>
            );
          })}
        </div>

        {/* Overview Panel */}
        {activeFolder === 'overview' && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
                    <div className="h-4 bg-gray-800 rounded w-1/2 mb-4" />
                    <div className="h-8 bg-gray-800 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : analytics ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Participation Health
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Active', value: analytics.participationHealth.active, color: 'text-green-400' },
                      { label: 'At Risk', value: analytics.participationHealth.atRisk, color: 'text-yellow-400' },
                      { label: 'Diminishing', value: analytics.participationHealth.diminishing, color: 'text-orange-400' },
                      { label: 'Paused', value: analytics.participationHealth.paused, color: 'text-red-400' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">{item.label}</p>
                        <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {totalParticipants > 0 ? Math.round((item.value / totalParticipants) * 100) : 0}% of total
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" /> Activity Insights
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Total Submissions', value: analytics.totalSubmissions, sub: 'All time' },
                      { label: 'Avg Frequency', value: analytics.avgFrequency.toFixed(1), sub: 'Activities per user' },
                      { label: 'Inactive Users', value: analytics.inactiveUsers, sub: 'Need attention' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">{item.label}</p>
                        <p className="text-2xl font-bold text-gray-100">{item.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-indigo-400" /> Stall Stage Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RePieChart>
                        <Pie data={stallStageData} cx="50%" cy="50%" labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80} dataKey="value">
                          {stallStageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#e5e7eb' }} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" /> Activity Metrics
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={activityTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#e5e7eb' }} />
                        <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}

        {/* Log Folder Panels */}
        {activeFolder !== 'overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100 capitalize flex items-center gap-2">
                {FOLDERS.find(f => f.key === activeFolder)?.icon}
                {FOLDERS.find(f => f.key === activeFolder)?.label} Logs
              </h2>
              <ExportButton type={activeFolder as 'ownership' | 'admin' | 'security' | 'participation'} format="csv" />
            </div>

            <FilterBar
              filters={filters}
              setFilter={setFilter}
              resetFilters={resetFilters}
              hasActiveFilters={hasActiveFilters}
              showType
              typeOptions={LOG_TYPE_OPTIONS}
              showUser={isAdmin}
            />

            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />)}
              </div>
            ) : currentLogs.length === 0 ? (
              <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
                <Folder className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No {activeFolder} logs found</p>
                {hasActiveFilters && <p className="text-sm text-gray-500 mt-1">Try clearing your filters</p>}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                {currentLogs.map((log, i) => renderLogEntry(log as Record<string, unknown>, i))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
