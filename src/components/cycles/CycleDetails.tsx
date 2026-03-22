/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useParticipation } from '@/hooks/useParticipation';
import CycleStatusBadge from './CycleStatusBadge';
import JoinBuildButton from '../participation/JoinBuildButton';
import ParticipationBadge from '../participation/ParticipationBadge';
import ActivityTimeline from '../activity/ActivityTimeline';
import {
  Calendar, Users, Activity, Play, Pause, Lock,
  RotateCcw, Clock, FileText, CheckSquare, AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { Task } from '@/types/task';
import type { DocumentMeta } from '@/types/docs';
import TaskDetailPanel from '@/components/tasks/TaskDetailPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleDetailsProps {
  cycle: any;
  userId?: string;
}

type TabId = 'overview' | 'tasks' | 'docs' | 'members' | 'activity';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  /** Permission required to view content; undefined = always accessible */
  requiredPermission?: 'docs:view' | 'users:view' | 'activity:submit';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STALL_COLOR: Record<string, string> = {
  active: 'bg-green-500',
  grace: 'bg-blue-500',
  at_risk: 'bg-yellow-500',
  diminishing: 'bg-orange-500',
  paused: 'bg-gray-500',
};

const TASK_STATUS_COLOR: Record<string, string> = {
  open: 'text-blue-400 bg-blue-900/30',
  in_progress: 'text-yellow-400 bg-yellow-900/30',
  completed: 'text-green-400 bg-green-900/30',
  overdue: 'text-red-400 bg-red-900/30',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Disabled tab tooltip wrapper ──────────────────────────────────────────────

function DisabledTabContent() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Lock className="w-10 h-10 text-gray-600 mb-3" />
      <p className="text-gray-400 font-medium">Access Restricted</p>
      <p className="text-sm text-gray-500 mt-1">You do not have access to this section</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-16" />
      ))}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ cycleId }: { cycleId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getTasks(cycleId);
      setTasks(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (!tasks.length) return <EmptyState icon={<CheckSquare className="w-10 h-10" />} message="No tasks for this cycle yet." />;

  return (
    <>
      <div className="space-y-3">
        {tasks.map(task => (
          <button
            key={task.id}
            onClick={() => setSelectedTaskId(task.id)}
            className="w-full text-left bg-gray-800 hover:bg-gray-750 rounded-xl p-4 flex items-start justify-between gap-4 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {task.restricted && <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                <p className="text-gray-100 font-medium truncate">{task.title}</p>
              </div>
              {task.description && (
                <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{task.description}</p>
              )}
              {task.assignments && task.assignments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {task.assignments.map(a => (
                    <span key={a.id} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                      {a.user?.name || a.user?.email || 'Unknown'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TASK_STATUS_COLOR[task.status] ?? 'text-gray-400 bg-gray-700'}`}>
                {task.status.replace('_', ' ')}
              </span>
              {task.dueDate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadTasks}
      />
    </>
  );
}

// ── Docs Tab ──────────────────────────────────────────────────────────────────

function DocsTab({ cycleId }: { cycleId: string }) {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch only docs tagged to this cycle (backend filters by cycleId tag in metadata).
    // Falls back to showing all user-accessible docs if none are tagged to this cycle.
    apiClient.getDocs({ cycleId })
      .then(data => setDocs(data.filter((d: DocumentMeta) => d.isActive)))
      .catch(e => setError(e.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (!docs.length) return <EmptyState icon={<FileText className="w-10 h-10" />} message="No accessible documents found." />;

  return (
    <div className="space-y-3">
      {docs.map(doc => (
        <div key={doc.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-100 font-medium truncate">{doc.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {doc.folder?.name ?? 'Root'} · {(doc.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
              doc.securityLabel === 'confidential' ? 'bg-red-900/40 text-red-400' :
              doc.securityLabel === 'restricted' ? 'bg-yellow-900/40 text-yellow-400' :
              'bg-gray-700 text-gray-400'
            }`}>
              {doc.securityLabel}
            </span>
            {doc.access ? (
              <a
                href={`/docs/view/${doc.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View
              </a>
            ) : (
              <span className="text-xs text-gray-600">No access</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({ cycleId }: { cycleId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getCycleParticipants(cycleId)
      .then(setMembers)
      .catch(e => setError(e.message || 'Failed to load members'))
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Skeleton rows={4} />;
  if (error) return <ErrorBanner message={error} />;
  if (!members.length) return <EmptyState icon={<Users className="w-10 h-10" />} message="No participants yet." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {members.map(m => (
        <div key={m.id} className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-300 text-sm font-semibold">
                {(m.user?.name || m.user?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-gray-100 text-sm font-medium">{m.user?.name || m.user?.email || 'Unknown'}</p>
                <p className="text-xs text-gray-500 capitalize">{m.user?.role ?? 'participant'}</p>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${STALL_COLOR[m.stallStage] ?? 'bg-gray-500'}`}
              title={`Stage: ${m.stallStage}`} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
            <span className="capitalize">{m.participationStatus}</span>
            <span>
              {m.lastActivityDate
                ? `Last active ${formatDate(m.lastActivityDate)}`
                : 'No activity yet'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CycleDetails({ cycle, userId }: CycleDetailsProps) {
  const { user } = useAuth();
  const { isAdmin, can } = usePermissions();
  const { participation, refetch } = useParticipation(userId, cycle.id);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activityCount, setActivityCount] = useState<number>(cycle.activityCount ?? 0);
  const [cycleState, setCycleState] = useState(cycle.state);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

  // Fetch activity count for the header stat
  useEffect(() => {
    apiClient.getActivities({ cycleId: cycle.id })
      .then(data => setActivityCount(data.length))
      .catch(() => {});
  }, [cycle.id]);

  const handleJoinSuccess = useCallback(() => { refetch(); }, [refetch]);

  const handleStateChange = async (newState: string) => {
    try {
      setStateLoading(true);
      setStateError(null);
      await apiClient.updateCycle(cycle.id, { state: newState });
      setCycleState(newState);
    } catch (err) {
      setStateError(err instanceof Error ? err.message : 'Failed to update cycle state');
    } finally {
      setStateLoading(false);
    }
  };

  const isActive = cycleState === 'active';
  const canJoin = isActive && !participation && userId;

  // Tab definitions with access rules
  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" />, requiredPermission: 'activity:submit' },
    { id: 'docs', label: 'Docs', icon: <FileText className="w-4 h-4" />, requiredPermission: 'docs:view' },
    { id: 'members', label: 'Members', icon: <Users className="w-4 h-4" />, requiredPermission: 'users:view' },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" />, requiredPermission: 'activity:submit' },
  ];

  const hasTabAccess = (tab: TabConfig) =>
    !tab.requiredPermission || can(tab.requiredPermission) || isAdmin;

  return (
    <div className="space-y-6">
      {/* ── Cycle Header ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold text-gray-100">{cycle.name}</h1>
              <CycleStatusBadge state={cycleState} />
            </div>
            {cycle.description && (
              <p className="text-gray-400 text-lg">{cycle.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Start Date</p>
              <p className="text-gray-100 font-semibold">{formatDate(cycle.startDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">End Date</p>
              <p className="text-gray-100 font-semibold">{formatDate(cycle.endDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Participants</p>
              <p className="text-gray-100 font-semibold">{cycle.participantCount ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Activities</p>
              <p className="text-gray-100 font-semibold">{activityCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin Controls ── */}
      {isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Admin Controls</h2>
          <p className="text-sm text-gray-400 mb-4">Manage cycle state and participant stall delays</p>

          {stateError && (
            <div className="bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
              {stateError}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {cycleState !== 'active' && cycleState !== 'closed' && (
              <button onClick={() => handleStateChange('active')} disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                <Play className="w-4 h-4" /> Activate Cycle
              </button>
            )}
            {cycleState === 'active' && (
              <button onClick={() => handleStateChange('paused')} disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                <Pause className="w-4 h-4" /> Pause Cycle
              </button>
            )}
            {cycleState === 'paused' && (
              <button onClick={() => handleStateChange('active')} disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                <Play className="w-4 h-4" /> Resume Cycle
              </button>
            )}
            {cycleState !== 'closed' && (
              <button
                onClick={() => { if (confirm('Close this cycle? This will finalize all participation records.')) handleStateChange('closed'); }}
                disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                <Lock className="w-4 h-4" /> Close Cycle
              </button>
            )}
            {cycleState === 'closed' && (
              <button onClick={() => handleStateChange('planned')} disabled={stateLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium">
                <RotateCcw className="w-4 h-4" /> Reopen as Planned
              </button>
            )}
            <a href="/admin/overrides"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm font-medium">
              <Clock className="w-4 h-4" /> Stall Delay Overrides
            </a>
          </div>

          {stateLoading && (
            <p className="text-sm text-gray-400 mt-3 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Updating cycle state...
            </p>
          )}
        </div>
      )}

      {/* ── Participation Status ── */}
      {userId && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Your Participation</h2>
          {participation ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ParticipationBadge participation={participation} />
                <div>
                  <p className="text-gray-300">Status: <span className="font-semibold">{participation.participationStatus}</span></p>
                  <p className="text-sm text-gray-400">Stall Stage: {participation.stallStage}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Last Activity</p>
                <p className="text-gray-300">
                  {participation.lastActivityDate
                    ? new Date(participation.lastActivityDate).toLocaleDateString()
                    : 'No activities yet'}
                </p>
              </div>
            </div>
          ) : canJoin ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">You&apos;re not participating in this cycle yet.</p>
              <JoinBuildButton userId={userId} cycleId={cycle.id} onSuccess={handleJoinSuccess} className="px-8 py-3 text-lg" />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">
                {!isActive ? 'This cycle is not currently active for new participants.' : 'You need to be logged in to participate.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tabbed Content ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800 overflow-x-auto">
          {tabs.map(tab => {
            const accessible = hasTabAccess(tab);
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={!accessible ? 'You do not have access to this section' : undefined}
                className={`
                  flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2
                  ${isActive
                    ? 'border-indigo-500 text-indigo-400'
                    : accessible
                      ? 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                      : 'border-transparent text-gray-600 cursor-not-allowed'}
                `}
              >
                {tab.icon}
                {tab.label}
                {!accessible && <Lock className="w-3 h-3 ml-0.5 opacity-60" />}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab cycle={cycle} cycleState={cycleState} participation={participation} isActive={isActive} canJoin={!!canJoin} userId={userId} onJoinSuccess={handleJoinSuccess} />}
          {activeTab === 'tasks' && (hasTabAccess(tabs[1]) ? <TasksTab cycleId={cycle.id} /> : <DisabledTabContent />)}
          {activeTab === 'docs' && (hasTabAccess(tabs[2]) ? <DocsTab cycleId={cycle.id} /> : <DisabledTabContent />)}
          {activeTab === 'members' && (hasTabAccess(tabs[3]) ? <MembersTab cycleId={cycle.id} /> : <DisabledTabContent />)}
          {activeTab === 'activity' && (
            hasTabAccess(tabs[4])
              ? (userId ? <ActivityTimeline userId={userId} cycleId={cycle.id} /> : <EmptyState icon={<Activity className="w-10 h-10" />} message="Sign in to view activity." />)
              : <DisabledTabContent />
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      {participation && isActive && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => window.location.href = '/activity'}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              Submit Activity
            </button>
            <button onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors font-medium">
              View Dashboard
            </button>
            <button onClick={() => window.location.href = '/team'}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors font-medium">
              Team Activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab (inline — uses already-fetched data) ─────────────────────────

function OverviewTab({
  cycle, cycleState, participation, isActive, canJoin, userId, onJoinSuccess,
}: {
  cycle: any;
  cycleState: string;
  participation: any;
  isActive: boolean;
  canJoin: boolean;
  userId?: string;
  onJoinSuccess: () => void;
}) {
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getActivities({ cycleId: cycle.id })
      .then(data => setRecentActivities(data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cycle.id]);

  return (
    <div className="space-y-6">
      {/* Recent Activities */}
      <div>
        <h3 className="text-base font-semibold text-gray-200 mb-3">Recent Activities</h3>
        {loading ? (
          <Skeleton />
        ) : recentActivities.length > 0 ? (
          <div className="space-y-2">
            {recentActivities.map((a: any) => (
              <div key={a.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    a.status === 'verified' ? 'bg-green-500' :
                    a.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="text-gray-200 text-sm font-medium capitalize">{a.contributionType?.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-400">{a.user?.name || 'Unknown'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{formatDate(a.createdAt)}</p>
                  <p className={`text-xs font-medium capitalize ${
                    a.status === 'verified' ? 'text-green-400' :
                    a.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                  }`}>{a.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Activity className="w-8 h-8" />} message="No activities submitted yet." />
        )}
      </div>
    </div>
  );
}
